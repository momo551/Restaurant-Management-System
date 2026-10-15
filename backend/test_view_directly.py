import os
import sys

# Setup django environment FIRST
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

import json
from rest_framework.test import APIRequestFactory
from orders.public_views import PublicOrderCreateView

def test_view_directly():
    factory = APIRequestFactory()
    view = PublicOrderCreateView.as_view()
    
    payload = {
        'customer_name': 'Test User',
        'customer_phone': '0123456789',
        'order_type': 'delivery',
        'items': [
            {'menu_item': 1, 'quantity': 1}
        ]
    }
    
    request = factory.post('/api/public/orders/', data=payload, format='json')
    response = view(request)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Data: {response.data}")

if __name__ == "__main__":
    test_view_directly()
