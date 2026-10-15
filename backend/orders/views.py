from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Order, OrderItem
from .serializers import OrderSerializer
from users.permissions import HasPOSAccess, HasKitchenAccess, HasDeliveryAccess, IsStaff
from users.utils import LoggingMixin
from django.db import transaction
from .models import Order, OrderItem, OrderAuditLog
from stock.utils import validate_stock_availability
import copy
from django.db.models import Q


class OrderViewSet(LoggingMixin, viewsets.ModelViewSet):
    queryset = Order.objects.all().prefetch_related('items__menu_item')
    serializer_class = OrderSerializer
    
    def get_queryset(self):
        user = self.request.user
        qs = Order.objects.filter(is_deleted=False).prefetch_related('items__menu_item')
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()
    
    def get_permissions(self):
        if self.action == 'customer_order':
            return [permissions.AllowAny()]
        if self.action == 'create':
            return [HasPOSAccess()]
        if self.action in ['next_status', 'hold', 'cancel']:
            # Use dynamic kitchen/orders access for these
            return [HasKitchenAccess()]
        if self.action in ['delivery_orders', 'update_delivery_status']:
            return [HasDeliveryAccess()]
        # Default to orders module access for list, retrieve, etc.
        return [HasKitchenAccess()]

    filterset_fields = ['status', 'order_type', 'table', 'delivery_status']

    def perform_create(self, serializer):
        user = self.request.user
        restaurant = getattr(user, 'restaurant', None)
        if not user.is_superuser and restaurant:
            instance = serializer.save(created_by=user, restaurant=restaurant)
        else:
            instance = serializer.save(created_by=user)
        self._log_action('create', instance)
        return instance

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def next_status(self, request, pk=None):
        """Advance order to the next status in the lifecycle."""
        # Kitchen can only advance certain statuses? 
        # For simplicity, we allow staff to advance if they have access to the order.
        order = self.get_object()
        
        # Role-based restriction on WHO can move WHAT status
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"KDS Advance: User={request.user}, Role={getattr(request.user, 'role', 'N/A')}, Status={order.status}")
        
        if request.user.role == 'kitchen' and order.status not in [Order.Status.PENDING, Order.Status.CONFIRMED, Order.Status.IN_KITCHEN, Order.Status.READY]:
            logger.warning(f"KDS Advance Blocked: Inactive status {order.status} for kitchen role")
            return Response({'error': f'المطبخ يمكنه فقط تحديث الطلبات النشطة. الحالة الحالية: {order.status}'}, status=status.HTTP_403_FORBIDDEN)



        # Define different lifecycles based on order type
        if order.order_type == Order.OrderType.TAKEAWAY:
            lifecycle = [
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.IN_KITCHEN,
                Order.Status.READY,
                Order.Status.DELIVERED,
            ]
        elif order.order_type == Order.OrderType.DELIVERY:
            lifecycle = [
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.IN_KITCHEN,
                Order.Status.READY,
                Order.Status.SERVED,
            ]
        else:
            # Dine-in follows the served path
            lifecycle = [
                Order.Status.PENDING,
                Order.Status.CONFIRMED,
                Order.Status.IN_KITCHEN,
                Order.Status.READY,
                Order.Status.SERVED,
            ]
        
        try:
            current_index = lifecycle.index(order.status)
        except ValueError:
            # Handle if current status is not in the expected lifecycle (e.g. manually set to something else)
            return Response({'error': f'الحالة الحالية ({order.status}) غير متوافقة مع مسار تنفيذ هذا النوع من الطلبات'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if current_index < len(lifecycle) - 1:
                order.status = lifecycle[current_index + 1]
                
                # If served/delivered/out_for_delivery, sync delivery status if applicable
                if order.order_type == Order.OrderType.DELIVERY:
                    if order.status in [Order.Status.CONFIRMED, Order.Status.IN_KITCHEN, Order.Status.READY, Order.Status.SERVED]:
                        order.delivery_status = Order.DeliveryStatus.PREPARING
                    elif order.status == Order.Status.OUT_FOR_DELIVERY:
                        order.delivery_status = Order.DeliveryStatus.OUT_FOR_DELIVERY
                    elif order.status == Order.Status.DELIVERED:
                        order.delivery_status = Order.DeliveryStatus.DELIVERED
                    
                order.save()
                return Response(OrderSerializer(order).data)
            else:
                return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)
        except ValueError as e:
            # Catch stock errors or other business logic errors raised during save
            # Ensure rollback because the status was already changed on the instance
            transaction.set_rollback(True)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in [Order.Status.PENDING, Order.Status.CONFIRMED, Order.Status.IN_KITCHEN]:
            order.status = Order.Status.CANCELLED
            if order.table:
                order.table.status = 'available'
                order.table.save()
            order.save()
            return Response(OrderSerializer(order).data)
        return Response({'error': 'Cannot cancel order in this stage'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        """Move order back to pending (holding it)."""
        order = self.get_object()
        if order.status == Order.Status.IN_KITCHEN:
            order.status = Order.Status.PENDING
            order.save()
            return Response(OrderSerializer(order).data)
        return Response({'error': 'Only orders in kitchen can be put on hold'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def delivery_orders(self, request):
        """Return all delivery orders, optionally filtered by delivery_status."""
        # Base queryset with restaurant filtering
        queryset = Order.objects.filter(
            order_type=Order.OrderType.DELIVERY
        ).prefetch_related('items__menu_item').select_related('delivery_agent')
        
        # Add restaurant filtering for non-superusers
        if not request.user.is_superuser and request.user.restaurant_id:
            queryset = queryset.filter(restaurant_id=request.user.restaurant_id)
        
        # If the user is a delivery agent, show only their orders OR unassigned pending orders
        if request.user.role == 'delivery':
            from django.db.models import Q
            queryset = queryset.filter(
                Q(delivery_agent=request.user) | Q(delivery_agent__isnull=True, delivery_status=Order.DeliveryStatus.PENDING)
            )

        delivery_status_filter = request.query_params.get('delivery_status')
        if delivery_status_filter:
            queryset = queryset.filter(delivery_status=delivery_status_filter)

        search = request.query_params.get('search', '').strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(customer_name__icontains=search) |
                Q(customer_phone__icontains=search) |
                Q(order_number__icontains=search)
            )

        queryset = queryset.order_by('-created_at')
        serializer = OrderSerializer(queryset, many=True)
        return Response(serializer.data)



    @action(detail=True, methods=['post'])
    def update_delivery_status(self, request, pk=None):
        """Update the delivery status of a delivery order."""
        order = self.get_object()

        if order.order_type != Order.OrderType.DELIVERY:
            return Response(
                {'error': 'هذا الطلب ليس دليفري'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Basic security for delivery agents
        if request.user.role == 'delivery' and order.delivery_agent and order.delivery_agent != request.user:
            return Response(
                {'error': 'لا يمكنك تحديث طلب مسند لمندوب آخر'},
                status=status.HTTP_403_FORBIDDEN
            )

        new_status = request.data.get('delivery_status')
        valid_statuses = [s[0] for s in Order.DeliveryStatus.choices]

        if not new_status:
            # Auto-advance to next status
            lifecycle = [
                Order.DeliveryStatus.PENDING,
                Order.DeliveryStatus.PREPARING,
                Order.DeliveryStatus.OUT_FOR_DELIVERY,
                Order.DeliveryStatus.DELIVERED,
            ]
            try:
                current_index = lifecycle.index(order.delivery_status)
                if current_index < len(lifecycle) - 1:
                    order.delivery_status = lifecycle[current_index + 1]
                else:
                    return Response(
                        {'error': 'الطلب وصل للحالة النهائية'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except ValueError:
                return Response(
                    {'error': 'حالة التوصيل الحالية غير صالحة'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif new_status in valid_statuses:
            order.delivery_status = new_status
        else:
            return Response(
                {'error': f'حالة غير صالحة. الحالات المتاحة: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Sync main order status based on delivery status
        if order.delivery_status == Order.DeliveryStatus.PREPARING:
            if order.status not in [Order.Status.CONFIRMED, Order.Status.IN_KITCHEN, Order.Status.READY]:
                order.status = Order.Status.IN_KITCHEN
        elif order.delivery_status == Order.DeliveryStatus.OUT_FOR_DELIVERY:
            order.status = Order.Status.OUT_FOR_DELIVERY
        elif order.delivery_status == Order.DeliveryStatus.DELIVERED:
            order.status = Order.Status.DELIVERED
        elif order.delivery_status == Order.DeliveryStatus.CANCELLED:
            order.status = Order.Status.CANCELLED

        # If agent claims a pending order
        if request.user.role == 'delivery' and not order.delivery_agent:
            order.delivery_agent = request.user

        # If starting delivery or delivered, ensure agent is assigned
        if order.delivery_status in [Order.DeliveryStatus.OUT_FOR_DELIVERY, Order.DeliveryStatus.DELIVERED] and not order.delivery_agent:
            order.delivery_agent = request.user

        # Also update the delivery_agent if provided (for admins)
        agent_id = request.data.get('delivery_agent')
        if agent_id and request.user.role in ['owner', 'manager']:
            order.delivery_agent_id = agent_id


        order.save()
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def edit(self, request, pk=None):
        """Edit an order with strict RBAC, saving audit logs, and recalculating totals."""
        from django.utils import timezone
        
        # Lock the row to prevent race conditions
        order = Order.objects.select_for_update().filter(pk=pk, is_deleted=False).first()
        if not order:
            return Response({'error': 'الطلب غير موجود أو محذوف'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Check if allowed to edit based on status
        if order.status not in [Order.Status.PENDING, Order.Status.IN_KITCHEN]:
            return Response({'error': 'لا يمكن التعديل على طلب بعد تجهيزه أو تقديمه أو إغلاقه'}, status=status.HTTP_403_FORBIDDEN)

        # 2. Check if invoice is paid
        if hasattr(order, 'invoice') and order.invoice.is_paid:
            return Response({'error': 'لا يمكن التعديل على طلب مدفوع'}, status=status.HTTP_403_FORBIDDEN)

        user_role = request.user.role
        
        # Cashier, Hall Captain, Hall Manager, Manager, Owner are allowed
        # (permissions technically restrict initial access, but let's double check here)
        allowed_roles = ['cashier', 'hall_captain', 'hall_manager', 'manager', 'owner']
        if user_role not in allowed_roles:
            return Response({'error': 'ليس لديك صلاحية لتعديل الطلبات'}, status=status.HTTP_403_FORBIDDEN)

        # Build snapshot before
        from .serializers import OrderSerializer
        data_before = OrderSerializer(order).data

        # Update order notes
        if 'notes' in request.data:
            order.notes = request.data['notes']
            
        # Update discount
        if 'discount_percentage' in request.data:
            order.discount_percentage = request.data['discount_percentage']

        # Update items
        if 'items' in request.data:
            items_data = request.data['items']
            if not items_data:
                 return Response({'error': 'الطلب يجب أن يحتوي على الأقل على صنف واحد'}, status=status.HTTP_400_BAD_REQUEST)
                 
            # Keep track of updated item IDs to delete the ones removed
            provided_item_ids = []
            
            # Stock Validation before changes
            validate_stock_availability(items_data, order, order.restaurant)
            
            for item_data in items_data:
                item_id = item_data.get('id')
                quantity = item_data.get('quantity', 1)
                
                # Check for negative total implication early (though subtotal recalculation handles final check)
                if quantity <= 0:
                     return Response({'error': 'كمية الصنف لا يمكن أن تكون صفر أو أقل'}, status=status.HTTP_400_BAD_REQUEST)

                if item_id:
                    # Update existing item
                    try:
                        order_item = OrderItem.objects.get(id=item_id, order=order)
                        order_item.quantity = quantity
                        if 'notes' in item_data:
                            order_item.notes = item_data['notes']
                        order_item.save()
                        provided_item_ids.append(order_item.id)
                    except OrderItem.DoesNotExist:
                        pass
                else:
                    # Create new item
                    menu_item_id = item_data.get('menu_item')
                    if not menu_item_id:
                        return Response({'error': 'الصنف مطلوب لإضافة منتج جديد'}, status=status.HTTP_400_BAD_REQUEST)
                    try:
                        from menu.models import MenuItem
                        # Filter by restaurant to prevent cross-tenant access
                        menu_item_queryset = MenuItem.objects.filter(id=menu_item_id)
                        if order.restaurant:
                            menu_item_queryset = menu_item_queryset.filter(category__restaurant=order.restaurant)
                        
                        menu_item = menu_item_queryset.get()
                        new_item = OrderItem.objects.create(
                            order=order,
                            menu_item=menu_item,
                            quantity=quantity,
                            unit_price=menu_item.price,
                            notes=item_data.get('notes', '')
                        )
                        provided_item_ids.append(new_item.id)
                    except MenuItem.DoesNotExist:
                         return Response({'error': f'الصنف ذو المعرف {menu_item_id} غير موجود'}, status=status.HTTP_400_BAD_REQUEST)

            # Removed items
            order.items.exclude(id__in=provided_item_ids).delete()

        # Mark as edited
        order.is_edited = True

        # Recalculate Totals
        # Note: calling update_total calculates subtotal, delivery_fee, commission, total.
        order.update_total()
        order.calculate_loyalty_points()
        
        if order.total < 0:
            return Response({'error': 'الإجمالي لا يمكن أن يكون بالسالب'}, status=status.HTTP_400_BAD_REQUEST)

        # Sync Invoice if exists
        if hasattr(order, 'invoice') and not order.invoice.is_deleted:
            invoice = order.invoice
            invoice.subtotal = order.subtotal
            # Save handles tax_amount and total_amount recalculation based on subtotal
            invoice.save()

        # Build snapshot after
        order.refresh_from_db()
        data_after = OrderSerializer(order).data
        
        # Save Audit Log
        OrderAuditLog.objects.create(
            order=order,
            user=request.user,
            action=OrderAuditLog.ActionType.EDIT,
            data_before=data_before,
            data_after=data_after
        )

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['delete'])
    def delete_order(self, request, pk=None):
        """Soft delete an order with specific role constraints."""
        from django.utils import timezone
        
        order = self.get_object()
        
        if order.is_deleted:
             return Response({'error': 'الطلب محذوف بالفعل'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Status Rules
        if order.status in [Order.Status.SERVED, Order.Status.PAID, Order.Status.CANCELLED]:
            return Response({'error': 'لا يمكن حذف طلب في هذه الحالة'}, status=status.HTTP_403_FORBIDDEN)
            
        if hasattr(order, 'invoice') and order.invoice.is_paid:
            return Response({'error': 'لا يمكن حذف طلب مدفوع'}, status=status.HTTP_403_FORBIDDEN)

        # 2. Role Rules
        user_role = request.user.role
        # Cashier never allowed to delete
        if user_role == 'cashier':
            return Response({'error': 'الكاشير لا يملك صلاحية حذف الطلبات'}, status=status.HTTP_403_FORBIDDEN)
        
        # Hall Captain / Manager / Owner allowed if pending (which is handled by status rule above)
        allowed_roles = ['hall_captain', 'hall_manager', 'manager', 'owner']
        if user_role not in allowed_roles:
            return Response({'error': 'ليس لديك صلاحية لحذف الطلبات'}, status=status.HTTP_403_FORBIDDEN)

        # Build snapshot before
        from .serializers import OrderSerializer
        data_before = OrderSerializer(order).data

        # 3. Perform Soft Delete
        with transaction.atomic():
            order.is_deleted = True
            order.deleted_at = timezone.now()
            order.deleted_by = request.user
            order.save()
            
            # Free table if dine in
            if order.table:
                # Check if other active orders exist for this table
                active_orders = Order.objects.filter(table=order.table, is_deleted=False).exclude(id=order.id).exists()
                if not active_orders:
                    order.table.status = 'available'
                    order.table.save()
            
            # Delete associated invoice if not paid
            if hasattr(order, 'invoice') and not order.invoice.is_paid:
                order.invoice.is_deleted = True
                order.invoice.deleted_at = timezone.now()
                order.invoice.deleted_by = request.user
                order.invoice.save()

            # Save Audit Log
            OrderAuditLog.objects.create(
                order=order,
                user=request.user,
                action=OrderAuditLog.ActionType.DELETE,
                data_before=data_before,
                data_after={}
            )

        return Response({'message': 'تم حذف الطلب بنجاح'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def customer_order(self, request):
        """Submit an order from the customer QR website."""
        from menu.models import MenuItem
        from tables.models import TableSession
        from loyalty.models import Customer
        
        session_token = request.data.get('session_token')
        items_data = request.data.get('items', [])
        customer_phone = request.data.get('customer_phone')
        
        if not session_token:
            return Response({'error': 'توكن الجلسة مطلوب'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            session = TableSession.objects.select_related('table__restaurant').get(
                session_token=session_token, is_active=True
            )
        except TableSession.DoesNotExist:
            return Response({'error': 'جلسة غير صالحة أو منتهية'}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = session.table.restaurant
        if not restaurant or not restaurant.is_active:
            return Response({'error': 'المطعم غير متاح حالياً'}, status=status.HTTP_400_BAD_REQUEST)

        # A QR session is bound to one physical table.  It is the authoritative
        # tenant context for this legacy endpoint, not a client supplied ID.
        requested_slug = request.data.get('restaurant_slug')
        if requested_slug and requested_slug != restaurant.slug:
            return Response({'error': 'سياق المطعم لا يطابق جلسة الطاولة'}, status=status.HTTP_400_BAD_REQUEST)

        menu_items = {}
        for item_data in items_data:
            menu_item_id = item_data.get('menu_item', item_data.get('id'))
            try:
                menu_item = MenuItem.objects.select_related('category__restaurant').get(id=menu_item_id)
            except MenuItem.DoesNotExist:
                return Response({'error': 'أحد الأصناف غير موجود'}, status=status.HTTP_400_BAD_REQUEST)
            if menu_item.category.restaurant_id != restaurant.id:
                return Response({'error': 'لا يمكن طلب أصناف من مطعم آخر'}, status=status.HTTP_400_BAD_REQUEST)
            menu_items[menu_item_id] = menu_item
            
        customer = None
        if customer_phone:
            customer = Customer.objects.filter(phone=customer_phone, restaurant=restaurant).first()
            if not customer:
                customer = Customer.objects.create(
                    name=request.data.get('customer_name', 'عميل QR'),
                    phone=customer_phone,
                    restaurant=restaurant,
                )
        
        # Stock Validation for QR Customer Order
        validate_stock_availability(items_data, restaurant=restaurant)
        
        # Generate order number
        import uuid
        order_number = f"QR-{uuid.uuid4().hex[:6].upper()}"
        
        order = Order.objects.create(
            order_number=order_number,
            order_type=Order.OrderType.DINE_IN,
            table=session.table,
            table_session=session,
            restaurant=restaurant,
            customer=customer,
            customer_name=request.data.get('customer_name', customer.name if customer else 'عميل QR'),
            customer_phone=customer_phone,
            status=Order.Status.PENDING,
            notes=request.data.get('notes', '')
        )
        
        for item_data in items_data:
            menu_item_id = item_data.get('menu_item', item_data.get('id'))
            menu_item = menu_items[menu_item_id]
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item_data['quantity'],
                unit_price=menu_item.price
            )
        
        order.update_total()
        order.calculate_loyalty_points()
        
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
