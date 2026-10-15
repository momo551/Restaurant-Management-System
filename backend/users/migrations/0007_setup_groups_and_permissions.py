from django.db import migrations

def setup_groups_and_permissions(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    
    # Create or get groups
    admin_group, _ = Group.objects.get_or_create(name='Admin')
    manager_group, _ = Group.objects.get_or_create(name='Manager')
    cashier_group, _ = Group.objects.get_or_create(name='Cashier')

    # For safety, ensure Cashier group doesn't have sensitive permissions
    # In this specific project, permissions are handled by role strings in views,
    # but cleaning up the DB permissions is good practice.
    
    sensitive_codenames = [
        'view_table', 'add_table', 'change_table', 'delete_table',
        'view_report', 'add_report', 'change_report', 'delete_report',
        'view_reservation', 'add_reservation', 'change_reservation', 'delete_reservation'
    ]
    
    permissions = Permission.objects.filter(codename__in=sensitive_codenames)
    for perm in permissions:
        cashier_group.permissions.remove(perm)

def reverse_setup(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0006_alter_user_role'), # Assuming 0006 is the last migration
    ]

    operations = [
        migrations.RunPython(setup_groups_and_permissions, reverse_setup),
    ]
