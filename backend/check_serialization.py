import os
import django
from decimal import Decimal

# Setup Django
import sys
project_path = os.path.dirname(os.path.abspath(__file__))
sys.path.append(project_path)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User
from users.serializers import UserSerializer

def check_user_data():
    print("Checking User Data and Serialization...")
    users = User.objects.all()
    if not users.exists():
        print("No users found.")
        return

    user = users.first()
    print(f"User: {user.username}")
    print(f"Attributes: {dir(user)}")
    print(f"total_commissions attribute exists: {hasattr(user, 'total_commissions')}")
    if hasattr(user, 'total_commissions'):
        print(f"total_commissions value: {user.total_commissions}")
        
    serializer = UserSerializer(user)
    print(f"Serialized Data: {serializer.data}")
    if 'total_commissions' in serializer.data:
        print(f"✅ total_commissions IS in serialized data: {serializer.data['total_commissions']}")
    else:
        print("❌ total_commissions IS NOT in serialized data.")

if __name__ == "__main__":
    check_user_data()
