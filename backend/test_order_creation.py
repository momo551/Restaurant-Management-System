import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.models import Order, OrderItem
from menu.models import MenuItem
from tables.models import Table
from django.contrib.auth import get_user_model
import traceback

User = get_user_model()

def test_create_order():
    try:
        admin = User.objects.get(username='admin')
        burger = MenuItem.objects.get(name="تشيز برجر كلاسيك")
        table = Table.objects.get(number=1)
        
        print("Attempting to create order...")
        order = Order.objects.create(
            order_number=f"TEST-{os.urandom(2).hex()}",
            order_type=Order.OrderType.DINE_IN,
            table=table,
            created_by=admin
        )
        
        print(f"Order {order.id} created. Now adding item...")
        item = OrderItem.objects.create(
            order=order,
            menu_item=burger,
            quantity=1,
            unit_price=burger.price
        )
        print("Order item added successfully!")
    except Exception as e:
        print("FAILED with error:")
        print(traceback.format_exc())

if __name__ == "__main__":
    test_create_order()
