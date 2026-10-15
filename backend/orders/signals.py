import logging

from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.exceptions import ValidationError
from .models import Order, OrderItem
from .groups import order_tracking_group_name
from stock.models import InventoryMovement

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Order)
def broadcast_order_update(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    # Prepare complete order data for broadcasting
    data = {
        "id": instance.id,
        "order_number": instance.order_number,
        "daily_id": getattr(instance, 'daily_id', None),
        "status": instance.status,
        "delivery_status": getattr(instance, 'delivery_status', None),
        "order_type": instance.order_type,
        "order_type_display": instance.get_order_type_display() if hasattr(instance, 'get_order_type_display') else instance.order_type,
        "table_number": instance.table.number if instance.table else None,
        "created_at": instance.created_at.isoformat(),
        "total": str(instance.total),
        "waiting_time": getattr(instance, 'waiting_time', 0),
        "priority_level": getattr(instance, 'priority_level', 'NORMAL'),
        "items": [
            {
                "name": item.menu_item.name,
                "quantity": item.quantity,
                "notes": item.notes,
                "menu_item_details": {
                    "name": item.menu_item.name
                }
            } for item in instance.items.all()
        ]
    }

    try:
        # 1. Broadcast to Kitchen Display System (Restaurant Scoped Group)
        restaurant_id = getattr(instance, 'restaurant_id', None)
        if not restaurant_id:
            # Do not broadcast orders without restaurant context
            return
        target_group = f"kitchen_display_{restaurant_id}"
        async_to_sync(channel_layer.group_send)(
            target_group,
            {
                "type": "order_update",
                "data": data
            }
        )

        # 2. Broadcast to the specific customer group (Order Tracking).
        # The group is scoped by restaurant id as well as order number, because
        # (restaurant, order_number) is the unique key: the same order_number can
        # exist in two different restaurants, and an unscoped group would leak
        # one tenant's order updates to the other tenant's customers.
        order_group = order_tracking_group_name(restaurant_id, instance.order_number)
        if order_group:
            async_to_sync(channel_layer.group_send)(
                order_group,
                {
                    "type": "order_status_update",
                    "data": data
                }
            )
    except Exception as e:
        # Broadcast failures must not break order processing, but they must not
        # disappear either: log with the traceback so they surface in production
        # instead of only on stdout.
        logger.exception(
            "WebSocket broadcast failed for order %s: %s",
            instance.pk,
            e,
        )

@receiver(pre_save, sender=OrderItem)
def store_old_quantity(sender, instance, **kwargs):
    """Store the old quantity before saving to calculate the exact difference for inventory."""
    if instance.pk:
        try:
            old_instance = OrderItem.objects.get(pk=instance.pk)
            instance._old_quantity = old_instance.quantity
        except OrderItem.DoesNotExist:
            instance._old_quantity = 0
    else:
        instance._old_quantity = 0

@receiver(post_save, sender=OrderItem)
def real_time_inventory_deduction(sender, instance, created, **kwargs):
    """Deduct or restore inventory immediately when an order item is added or changed."""
    # Skip if order is already cancelled/deleted to prevent double accounting
    if instance.order.status == Order.Status.CANCELLED or instance.order.is_deleted:
        return

    with transaction.atomic():
        old_qty = getattr(instance, '_old_quantity', 0)
        new_qty = instance.quantity
        diff = Decimal(str(new_qty)) - Decimal(str(old_qty))
        
        if diff == 0:
            return
            
        reason = InventoryMovement.Reason.ORDER_CREATED if created else InventoryMovement.Reason.ORDER_UPDATED
        movement_type = InventoryMovement.MovementType.DEDUCT if diff > 0 else InventoryMovement.MovementType.RESTORE
        abs_diff = abs(diff)
        
        recipes = instance.menu_item.recipes.all()
        for recipe in recipes:
            ingredient = recipe.ingredient
            req = Decimal(str(recipe.quantity_required))
            adjustment = req * abs_diff
            
            if diff > 0:
                if ingredient.quantity < adjustment:
                    raise ValidationError({'error': f"رصيد غير كافٍ في المخزن لمكون: {ingredient.name}"})
                ingredient.quantity -= adjustment
            else:
                ingredient.quantity += adjustment
                
            ingredient.save()
            
            InventoryMovement.objects.create(
                ingredient=ingredient,
                quantity=adjustment,
                movement_type=movement_type,
                reason=reason,
                order_id=instance.order.id
            )

@receiver(post_delete, sender=OrderItem)
def restore_inventory_on_item_delete(sender, instance, **kwargs):
    """Restore inventory when an item is removed from the order."""
    if instance.order.status == Order.Status.CANCELLED or instance.order.is_deleted:
        return
        
    with transaction.atomic():
        qty = Decimal(str(instance.quantity))
        recipes = instance.menu_item.recipes.all()
        
        for recipe in recipes:
            ingredient = recipe.ingredient
            req = Decimal(str(recipe.quantity_required))
            restoration = req * qty
            
            ingredient.quantity += restoration
            ingredient.save()
            
            InventoryMovement.objects.create(
                ingredient=ingredient,
                quantity=restoration,
                movement_type=InventoryMovement.MovementType.RESTORE,
                reason=InventoryMovement.Reason.ORDER_DELETED,
                order_id=instance.order.id
            )

@receiver(pre_save, sender=Order)
def store_old_order_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = Order.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
            instance._old_is_deleted = old_instance.is_deleted
        except Order.DoesNotExist:
            instance._old_status = None
            instance._old_is_deleted = False
    else:
        instance._old_status = None
        instance._old_is_deleted = False

@receiver(post_save, sender=Order)
def restore_inventory_on_order_cancel(sender, instance, created, **kwargs):
    """Restore inventory for all items if an order is cancelled or soft-deleted."""
    old_status = getattr(instance, '_old_status', None)
    old_is_deleted = getattr(instance, '_old_is_deleted', False)
    
    just_cancelled = (instance.status == Order.Status.CANCELLED and old_status != Order.Status.CANCELLED)
    just_deleted = (instance.is_deleted and not old_is_deleted)
    
    if just_cancelled or just_deleted:
        reason = InventoryMovement.Reason.ORDER_CANCELLED if just_cancelled else InventoryMovement.Reason.ORDER_DELETED
        
        with transaction.atomic():
            for item in instance.items.all():
                qty = Decimal(str(item.quantity))
                recipes = item.menu_item.recipes.all()
                for recipe in recipes:
                    ingredient = recipe.ingredient
                    req = Decimal(str(recipe.quantity_required))
                    restoration = req * qty
                    
                    ingredient.quantity += restoration
                    ingredient.save()
                    
                    InventoryMovement.objects.create(
                        ingredient=ingredient,
                        quantity=restoration,
                        movement_type=InventoryMovement.MovementType.RESTORE,
                        reason=reason,
                        order_id=instance.id
                    )
@receiver(post_save, sender=Order)
def handle_loyalty_on_status_change(sender, instance, created, **kwargs):
    """Update customer loyalty points when order is marked as PAID."""
    old_status = getattr(instance, '_old_status', None)
    
    TERMINAL_STATES = [Order.Status.SERVED, Order.Status.DELIVERED, Order.Status.PAID]
    if instance.status in TERMINAL_STATES and old_status not in TERMINAL_STATES:
        instance.update_customer_loyalty()

