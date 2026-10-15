import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.models import Order
from users.models import ActivityLog

def check_recent():
    print(f"Total Orders: {Order.objects.count()}")
    print(f"Total ActivityLogs: {ActivityLog.objects.count()}")
    
    last_order = Order.objects.order_by('-id').first()
    if last_order:
        print(f"Last Order: ID={last_order.id}, Number={last_order.order_number}, Status={last_order.status}, CreatedAt={last_order.created_at}")
    
    last_log = ActivityLog.objects.order_by('-id').first()
    if last_log:
        print(f"Last Log: ID={last_log.id}, Action={last_log.action}, Description={last_log.description}")

if __name__ == "__main__":
    check_recent()
