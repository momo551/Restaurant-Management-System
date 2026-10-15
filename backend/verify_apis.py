import os
import django
from django.test import Client
from django.contrib.auth import get_user_model
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

User = get_user_model()

def verify_apis():
    client = Client()
    admin = User.objects.get(username='admin')
    client.force_login(admin)
    
    print("1. Testing GET /api/stock/recipes/grouped_by_menu_item/ ...")
    response = client.get('/api/stock/recipes/grouped_by_menu_item/')
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.content.decode()}")
    else:
        print("Success!")

    print("\n2. Testing POST /api/orders/ ...")
    order_data = {
        "order_type": "dine_in",
        "table": 1,
        "items": [
            {
                "menu_item": 1,
                "quantity": 1,
                "notes": "Test order"
            }
        ]
    }
    response = client.post('/api/orders/', data=json.dumps(order_data), content_type='application/json')
    print(f"Status: {response.status_code}")
    if response.status_code not in [200, 201]:
        print(f"Error: {response.content.decode()}")
    else:
        print("Success!")

if __name__ == "__main__":
    verify_apis()
