import os
import django
from django.test import Client
from django.contrib.auth import get_user_model

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

User = get_user_model()

def verify_pdf_export():
    client = Client()
    try:
        admin = User.objects.get(username='admin')
    except User.DoesNotExist:
        admin = User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    
    client.force_login(admin)
    
    print("Testing GET /api/users/activity-logs/export_pdf/ ...")
    response = client.get('/api/users/activity-logs/export_pdf/')
    
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.get('Content-Type')}")
    
    if response.status_code == 200 and response.get('Content-Type') == 'application/pdf':
        with open('test_audit_log.pdf', 'wb') as f:
            f.write(response.content)
        print("Success! PDF saved as test_audit_log.pdf")
    else:
        print(f"Error: {response.content[:500].decode() if response.content else 'No content'}")

if __name__ == "__main__":
    verify_pdf_export()
