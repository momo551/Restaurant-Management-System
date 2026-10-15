import threading
import logging
from django.db import transaction
from .models import Order

logger = logging.getLogger(__name__)

def update_order_to_delivered_internal(order_id, restaurant_id):
    """
    Function meant to be run in a background thread to update order status.
    """
    try:
        # Use transaction.atomic to ensure DB consistency
        with transaction.atomic():
            # Select for update to avoid race conditions with restaurant filtering
            order = Order.objects.select_for_update().get(id=order_id, restaurant_id=restaurant_id)
            
            if order.order_type == Order.OrderType.TAKEAWAY and order.status == Order.Status.PENDING:
                order.status = Order.Status.DELIVERED
                order.save(update_fields=['status', 'updated_at'])
                logger.info(f"Order {order.order_number} automatically updated to DELIVERED by background thread.")
            else:
                logger.info(f"Order {order.order_number} auto-update skipped (Status: {order.status}).")
                
    except Order.DoesNotExist:
        logger.error(f"Order with ID {order_id} and restaurant_id {restaurant_id} not found for background update.")
    except Exception as e:
        logger.error(f"Error in background update for order {order_id}: {str(e)}")

def schedule_order_delivery_timer(order_id, restaurant_id, delay=10):
    """
    Schedules the status update using a threading.Timer.
    """
    timer = threading.Timer(delay, update_order_to_delivered_internal, args=[order_id, restaurant_id])
    timer.daemon = True  # Ensure it doesn't block program exit
    # Note: In Django dev server, threads might be killed on hot reload.
    # In production (Gunicorn/uWSGI), threads are generally fine for short lived tasks.
    timer.start()
