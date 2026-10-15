import os
import django
from decimal import Decimal

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.models import Order, OrderItem
from menu.models import MenuItem, Category
from loyalty.models import Customer

def test_delivery_loyalty():
    # 1. Setup Data
    category, _ = Category.objects.get_or_create(name='Test Category')
    menu_item, _ = MenuItem.objects.get_or_create(
        name='Test Item', 
        defaults={'price': Decimal('100.00'), 'category': category}
    )
    customer, _ = Customer.objects.get_or_create(
        phone='0000000000', 
        defaults={'name': 'Loyalty Test Customer'}
    )

    # 2. Create a Delivery Order
    # Items = 100 * 2 = 200
    # Delivery fee should be 25 (if < 500)
    # Total should be 225
    order = Order.objects.create(
        order_number='TEST-DEL-001',
        order_type=Order.OrderType.DELIVERY,
        customer=customer,
        customer_name=customer.name,
        customer_phone=customer.phone
    )
    
    OrderItem.objects.create(
        order=order,
        menu_item=menu_item,
        quantity=2,
        unit_price=menu_item.price
    )
    
    # Recalculate totals
    order.update_total()
    
    print(f"Order Type: {order.order_type}")
    print(f"Subtotal: {order.subtotal}")
    print(f"Delivery Fee: {order.delivery_fee}")
    print(f"Total: {order.total}")

    # 3. Calculate Points
    order.calculate_loyalty_points()
    print(f"Loyalty Points Earned: {order.loyalty_points_earned}")

    # Expected: 200 (since 1 point per 1 EGP on subtotal)
    # If it was using the full total, it would be 225
    if order.loyalty_points_earned == 200:
        print("SUCCESS: Loyalty points calculated correctly (excl. delivery fee)")
    else:
        print(f"FAILURE: Expected 200 points, got {order.loyalty_points_earned}")

    # 4. Cleanup
    # order.delete() # Leave for manual inspection if needed

if __name__ == "__main__":
    test_delivery_loyalty()
