import os
import django
import sys

# Setup django environment
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.serializers import OrderSerializer
from orders.models import Order
from decimal import Decimal

def test_dine_in_restriction():
    print("Running Dine-in Restriction Tests...")
    
    # Test 1: Try to create a dine-in order without table/session
    data = {
        'customer_name': 'Test User',
        'customer_phone': '0123456789',
        'order_type': 'dine_in',
        'items': [] # Validating order_type comes before items check or during same validate pass
    }
    
    serializer = OrderSerializer(data=data)
    if not serializer.is_valid():
        errors = serializer.errors
        if 'order_type' in errors:
            print("✅ Test 1 Passed: Order without table/session blocked as expected.")
            print(f"Error: {errors['order_type']}")
        else:
            print("❌ Test 1 Failed: Order was blocked but not for the expected reason.")
            print(f"Errors: {errors}")
    else:
        print("❌ Test 1 Failed: Order with dine_in but no table was allowed!")

    # Test 2: Try to create a takeaway order (should be allowed if items were present)
    data['order_type'] = 'takeaway'
    serializer = OrderSerializer(data=data)
    serializer.is_valid() # We don't care about other errors like missing items here, just order_type
    if 'order_type' in serializer.errors:
        print("❌ Test 2 Failed: Takeaway order blocked unexpectedly.")
    else:
        print("✅ Test 2 Passed: Takeaway order allowed (no order_type error).")

if __name__ == "__main__":
    try:
        from menu.models import MenuItem # Ensure models are loaded
        test_dine_in_restriction()
    except Exception as e:
        print(f"Error during testing: {e}")
