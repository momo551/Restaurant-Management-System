import os
import django
import sys
import json
from django.test import Client
from django.urls import reverse

# Setup django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from menu.models import MenuItem
from loyalty.models import Customer
from orders.models import Order

def test_public_order_creation():
    client = Client()
    url = '/api/public/orders/'
    
    # Ensure a menu item exists
    menu_item = MenuItem.objects.first()
    if not menu_item:
        print("No menu items found!")
        return

    payload = {
        'customer_name': 'Test User',
        'customer_phone': '0123456789',
        'order_type': 'delivery',
        'delivery_address': 'Test Address',
        'items': [
            {'menu_item': menu_item.id, 'quantity': 1}
        ]
    }
    
    print(f"Sending payload to {url}:")
    print(json.dumps(payload, indent=2))
    
    response = client.post(url, data=json.dumps(payload), content_type='application/json')
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.content.decode('utf-8')}")

    if response.status_code == 400:
        print("❌ Replicated 400 Error!")
    elif response.status_code == 201:
        print("✅ Successfully created order (Backend is fine for this payload)")
    else:
        print(f"Unexpected status code: {response.status_code}")

if __name__ == "__main__":
    test_public_order_creation()
