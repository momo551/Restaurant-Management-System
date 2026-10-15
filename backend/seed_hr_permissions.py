import os
import django
import sys

# Ensure the project root is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import ModulePermission

def seed_hr_permissions():
    hr_permissions = [
        {'module_key': 'staff', 'module_label': 'الموظفين', 'allowed': True},
        {'module_key': 'reports', 'module_label': 'التقارير', 'allowed': True},
        {'module_key': 'staff_performance', 'module_label': 'أداء الموظفين', 'allowed': True},
        {'module_key': 'audit_log', 'module_label': 'سجل المراجعة', 'allowed': True},
        {'module_key': 'permissions_matrix', 'module_label': 'مصفوفة الصلاحيات', 'allowed': True},
    ]

    for perm in hr_permissions:
        obj, created = ModulePermission.objects.update_or_create(
            role='hr',
            module_key=perm['module_key'],
            defaults={
                'module_label': perm['module_label'],
                'allowed': perm['allowed']
            }
        )
        status = "Created" if created else "Updated"
        print(f"{status} permission for HR: {perm['module_key']}")

    print("HR permissions seeding complete.")

if __name__ == '__main__':
    seed_hr_permissions()
