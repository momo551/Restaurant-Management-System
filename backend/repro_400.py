import os
import django
import sys
import json

# Setup django environment
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from orders.serializers import OrderSerializer
from rest_framework import serializers

def test_public_order_payload():
    print("Testing Public Order Payload...")
    
    # Payload similar to what CheckoutPage.jsx sends
    payload = {
        'customer_name': 'Test Customer',
        'customer_phone': '0123456789',
        'order_type': 'delivery',
        'items': [
            {'menu_item': 1, 'quantity': 2} # FIXED: menu_item instead of id
        ]
    }
    
    serializer = OrderSerializer(data=payload)
    is_valid = serializer.is_valid()
    
    print(f"Is Valid: {is_valid}")
    if not is_valid:
        print(f"Errors: {json.dumps(serializer.errors, indent=2, ensure_ascii=False)}")
    else:
        print("✅ Payload is valid (theory debunked or model handles id?)")

if __name__ == "__main__":
    test_public_order_payload()
