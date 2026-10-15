import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def check_admin():
    try:
        admin = User.objects.get(username='admin')
        print(f"User: {admin.username}, Role: {admin.role}, IsAuthenticated: {admin.is_authenticated}")
        print(f"Permissions: IsOwner: {admin.role == 'owner'}")
    except User.DoesNotExist:
        print("Admin user not found!")

if __name__ == "__main__":
    check_admin()
