import os
import django
import sys
import json

# Setup django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.serializers import OrderSerializer
from orders.models import Order

def inspect_serializer():
    payload = {
        'customer_name': 'Test User',
        'customer_phone': '0123456789',
        'order_type': 'delivery',
        'items': [
            {'menu_item': 1, 'quantity': 1}
        ]
    }
    
    serializer = OrderSerializer(data=payload)
    is_valid = serializer.is_valid()
    
    print(f"Is Valid: {is_valid}")
    if not is_valid:
        print(f"Errors: {serializer.errors}")
    else:
        print(f"Validated Data: {serializer.validated_data}")
        print(f"Order Type in Validated Data: {serializer.validated_data.get('order_type')}")
        print(f"Order.OrderType.DINE_IN: {Order.OrderType.DINE_IN}")
        print(f"Match: {serializer.validated_data.get('order_type') == Order.OrderType.DINE_IN}")

    # Inspect the field itself
    field = serializer.fields['order_type']
    print(f"Field class: {field.__class__.__name__}")
    print(f"Field choices: {getattr(field, 'choices', 'No choices')}")

if __name__ == "__main__":
    inspect_serializer()
