import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.serializers import OrderSerializer
from menu.models import MenuItem

def test_serializer_validation():
    print("Testing OrderSerializer validation...")
    
    item = MenuItem.objects.first()
    if not item:
        print("No menu items found. Please create one.")
        return

    data = {
        "order_type": "dine_in",
        "items": [
            {"menu_item": item.id, "quantity": 1, "unit_price": float(item.price)}
        ],
        "customer_name": "",  # EMPTY
        "customer_phone": ""  # EMPTY
    }
    
    serializer = OrderSerializer(data=data)
    is_valid = serializer.is_valid()
    
    print(f"Is Valid: {is_valid}")
    if not is_valid:
        print(f"Errors: {serializer.errors}")
        if 'customer_name' in serializer.errors and 'customer_phone' in serializer.errors:
            print("SUCCESS: Serializer rejected empty fields.")
        else:
            print("FAILURE: Serializer did not reject name/phone as expected.")
    else:
        print("FAILURE: Serializer accepted empty fields.")

if __name__ == "__main__":
    test_serializer_validation()
