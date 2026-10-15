import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import ModulePermission

def setup_production():
    User = get_user_model()
    default_password = os.environ.get('DEFAULT_PASS')

    if not default_password:
        raise ValueError(
            "DEFAULT_PASS environment variable is required for creating default accounts. "
            "Set it to a strong password before running this script."
        )

    from tenants.models import Restaurant

    # Get or create default restaurant for multi-tenant isolation
    default_restaurant, _ = Restaurant.objects.get_or_create(
        slug='main-branch',
        defaults={
            'name': 'المطعم الرئيسي',
            'phone': '01000000000',
            'address': 'الفرع الرئيسي',
            'is_active': True,
        }
    )

    # 1. User Roles & Accounts Mapping
    accounts = [
        {'username': 'admin', 'email': 'owner@restaurant.com', 'role': 'owner'},
        {'username': 'manager', 'email': 'manager@restaurant.com', 'role': 'manager'},
        {'username': 'cashier', 'email': 'cashier@restaurant.com', 'role': 'cashier'},
        {'username': 'kitchen', 'email': 'kitchen@restaurant.com', 'role': 'kitchen'},
        {'username': 'delivery', 'email': 'delivery@restaurant.com', 'role': 'delivery'},
        {'username': 'hr', 'email': 'hr@restaurant.com', 'role': 'hr'},
        {'username': 'stock_manager', 'email': 'stock@restaurant.com', 'role': 'inventory_manager'},
        {'username': 'hall_manager', 'email': 'hall@restaurant.com', 'role': 'hall_manager'},
        {'username': 'captain', 'email': 'captain@restaurant.com', 'role': 'hall_captain'},
    ]

    print("--- Creating Production Accounts ---")
    for acc in accounts:
        if not User.objects.filter(username=acc['username']).exists():
            print(f"Creating {acc['role']} account: {acc['username']}")
            User.objects.create_user(
                username=acc['username'],
                email=acc['email'],
                password=default_password,
                role=acc['role'],
                is_staff=True,
                is_superuser=(acc['role'] == 'owner'),
                restaurant=default_restaurant
            )
        else:
            print(f"Account {acc['username']} already exists (password unchanged).")

    # 2. Permissions Matrix Setup
    # Modules from App.jsx
    all_modules = [
        ('dashboard', 'لوحة التحكم'),
        ('menu', 'إدارة المنيو'),
        ('loyalty', 'الولاء والعملاء'),
        ('tables', 'تنسيق الطاولات'),
        ('orders', 'قائمة الطلبات'),
        ('kds', 'شاشة المطبخ'),
        ('pos', 'نقطة البيع POS'),
        ('delivery_monitor', 'مراقبة التوصيل'),
        ('staff', 'إدارة الموظفين'),
        ('reports', 'التقارير'),
        ('delivery_agent', 'حساب الطيار'),
        ('ingredients', 'المكونات'),
        ('suppliers', 'الموردين'),
        ('recipes', 'الوصفات'),
        ('inventory_movements', 'حركة المخزن'),
        ('low_stock', 'تنبيهات نقص المخزون'),
        ('waste_management', 'إدارة الهالك'),
        ('menu_analytics', 'تحليلات المنيو'),
        ('staff_performance', 'أداء الموظفين'),
        ('audit_log', 'سجل النشاطات'),
        ('permissions_matrix', 'مصفوفة الصلاحيات'),
    ]

    # Permission Rules
    rules = {
        'owner': [m[0] for m in all_modules],
        'manager': ['dashboard', 'menu', 'loyalty', 'reports', 'menu_analytics', 'staff_performance'],
        'inventory_manager': ['ingredients', 'suppliers', 'recipes', 'inventory_movements', 'low_stock', 'waste_management'],
        'cashier': ['pos', 'orders'],
        'kitchen': ['orders', 'kds'],
        'delivery': ['delivery_agent'],
        'hall_manager': ['dashboard', 'tables', 'orders', 'pos', 'delivery_monitor', 'reports', 'staff_performance'],
        'hall_captain': ['tables', 'orders', 'pos'],
        'hr': ['staff', 'reports', 'staff_performance', 'audit_log', 'permissions_matrix'],
    }

    print("\n--- Seeding Permissions Matrix ---")
    for role, allowed_modules in rules.items():
        for module_key, module_label in all_modules:
            is_allowed = module_key in allowed_modules
            ModulePermission.objects.update_or_create(
                restaurant=default_restaurant,
                role=role,
                module_key=module_key,
                defaults={'module_label': module_label, 'allowed': is_allowed}
            )
        print(f"Applied permissions mapping for role: {role}")

    print("\nProduction setup completed successfully!")

if __name__ == '__main__':
    setup_production()
