import os
import django
import sys

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = ['*']

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.urls import reverse

User = get_user_model()

def debug():
    client = APIClient()
    try:
        user = User.objects.get(username='Ahmed33333')
        print(f"User found: {user.username}, Role: {user.role}")
        
        client.force_authenticate(user=user)
        
        url = reverse('reports-dashboard-stats')
        response = client.get(url)
        print(f"Dashboard Stats: status={response.status_code}, data={response.data if response.status_code == 200 else response.content}")
        
    except User.DoesNotExist:
        print("User Ahmed33333 not found")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    debug()
