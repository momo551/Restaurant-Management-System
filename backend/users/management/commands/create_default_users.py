import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import ModulePermission


class Command(BaseCommand):
    help = 'Creates default production accounts and permissions if they do not exist'

    def handle(self, *args, **options):
        User = get_user_model()
        default_password = os.environ.get('DEFAULT_PASS')

        if not default_password:
            self.stderr.write(
                self.style.ERROR(
                    "DEFAULT_PASS environment variable is required. "
                    "Set it to a strong password before running this command."
                )
            )
            raise ValueError("DEFAULT_PASS environment variable is required")

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

        self.stdout.write('--- Creating Production Accounts ---')
        for acc in accounts:
            user, created = User.objects.get_or_create(
                username=acc['username'],
                defaults={
                    'email': acc['email'],
                    'role': acc['role'],
                    'is_staff': True,
                    'is_active': True,
                    'is_superuser': (acc['role'] == 'owner'),
                    'restaurant': default_restaurant
                }
            )
            # Only set password on creation - never overwrite existing passwords
            if created:
                user.set_password(default_password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"  Created: {acc['username']} ({acc['role']})"))
            else:
                # Ensure restaurant is set for existing users (idempotent backfill)
                if user.restaurant is None:
                    user.restaurant = default_restaurant
                    user.save()
                    self.stdout.write(f"  Updated: {acc['username']} (restaurant assigned)")
                else:
                    self.stdout.write(f"  Skipped: {acc['username']} (already exists, password unchanged)")

        # Permissions matrix
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

        self.stdout.write('\n--- Seeding Permissions Matrix ---')
        for role, allowed_modules in rules.items():
            for module_key, module_label in all_modules:
                is_allowed = module_key in allowed_modules
                ModulePermission.objects.update_or_create(
                    restaurant=default_restaurant,
                    role=role,
                    module_key=module_key,
                    defaults={'module_label': module_label, 'allowed': is_allowed}
                )
            self.stdout.write(self.style.SUCCESS(f"  Permissions set for: {role}"))

        self.stdout.write(self.style.SUCCESS('\n✅ Production setup completed successfully!'))
