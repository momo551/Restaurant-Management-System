import os
import django
from django.test import Client
from django.contrib.auth import get_user_model
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

User = get_user_model()

def verify_reports():
    client = Client()
    admin = User.objects.get(username='admin')
    client.force_login(admin)
    
    print("Testing GET /api/reports/menu_performance/?period=30days ...")
    response = client.get('/api/reports/menu_performance/?period=30days')
    print(f"Status: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.content.decode()}")
    else:
        print("Success! Data received:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    verify_reports()
