import os
import django
from decimal import Decimal

# Setup Django
import sys
project_path = os.path.dirname(os.path.abspath(__file__))
sys.path.append(project_path)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.models import Order
from users.models import User
from django.db import transaction

def sync_commissions():
    print("Syncing historical commissions...")
    
    # 1. First, recalculate commissions for ALL delivery orders if they are 0
    # (In case they were created before the logic was added)
    delivery_orders = Order.objects.filter(order_type=Order.OrderType.DELIVERY)
    for order in delivery_orders:
        if order.delivery_commission == 0:
            order.update_total() # This recalculates commission
    
    # 2. Reset all driver commission balances to avoid double counting from this script
    # User.objects.filter(role=User.Role.DELIVERY).update(total_commissions=0)
    
    # 3. Process all delivered/paid orders that haven't been accumulated yet
    orders_to_sync = Order.objects.filter(
        order_type=Order.OrderType.DELIVERY,
        delivery_agent__isnull=False,
        commission_accumulated=False,
        status='paid' # or delivery_status='delivered'
    ) | Order.objects.filter(
        order_type=Order.OrderType.DELIVERY,
        delivery_agent__isnull=False,
        commission_accumulated=False,
        delivery_status='delivered'
    )
    
    orders_to_sync = orders_to_sync.distinct()
    
    print(f"Found {orders_to_sync.count()} orders to sync.")
    
    with transaction.atomic():
        for order in orders_to_sync:
            agent = order.delivery_agent
            agent.total_commissions += order.delivery_commission
            agent.save(update_fields=['total_commissions'])
            order.commission_accumulated = True
            order.save(update_fields=['commission_accumulated'])
            print(f"Synced Order {order.order_number}: {order.delivery_commission} EGP -> {agent.username}")

    print("Sync completed!")

if __name__ == "__main__":
    sync_commissions()
