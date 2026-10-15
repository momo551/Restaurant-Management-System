import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from menu.models import MenuItem

User = get_user_model()

def test_api_validation():
    print("Testing backend validation via API...")
    
    # We need a relative path or full URL. Assuming local server on 8000
    url = "http://localhost:8000/api/orders/"
    
    # Get a valid menu item
    item = MenuItem.objects.first()
    if not item:
        print("No menu items found. Cannot test.")
        return

    payload = {
        "order_type": "dine_in",
        "items": [
            {"menu_item": item.id, "quantity": 1, "unit_price": float(item.price)}
        ],
        "customer_name": "",  # EMPTY
        "customer_phone": ""  # EMPTY
    }
    
    # Authenticate (simplified for test, assuming admin user exists)
    try:
        from rest_framework.authtoken.models import Token
        admin = User.objects.get(username='admin')
        token, _ = Token.objects.get_or_create(user=admin)
        headers = {'Authorization': f'Token {token.key}', 'Content-Type': 'application/json'}
        
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 400:
            print("SUCCESS: API rejected empty fields.")
        else:
            print("FAILURE: API accepted empty fields or returned unexpected status.")
            
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    test_api_validation()
