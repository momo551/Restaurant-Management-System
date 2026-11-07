from django.db import migrations


WEBSITE_MODULE_KEY = 'website'
WEBSITE_MODULE_LABEL = 'إدارة موقع العميل'
WEBSITE_ROLES = [
    'owner', 'manager', 'inventory_manager', 'cashier', 'kitchen',
    'delivery', 'hall_manager', 'hall_captain', 'hr',
]
# Policy: the owner always has access (enforced in code); managers may manage the
# customer website by default. Every other role starts denied and can be granted
# later from the permissions matrix.
WEBSITE_ALLOWED_ROLES = {'owner', 'manager'}


def seed_website_permissions(apps, schema_editor):
    Restaurant = apps.get_model('tenants', 'Restaurant')
    ModulePermission = apps.get_model('users', 'ModulePermission')

    restaurants = list(Restaurant.objects.all())
    # Also seed global (restaurant=NULL) fallback rows so restaurants created
    # after this migration inherit the same defaults.
    scopes = restaurants + [None]

    for restaurant in scopes:
        for role in WEBSITE_ROLES:
            ModulePermission.objects.update_or_create(
                restaurant=restaurant,
                role=role,
                module_key=WEBSITE_MODULE_KEY,
                defaults={
                    'module_label': WEBSITE_MODULE_LABEL,
                    'allowed': role in WEBSITE_ALLOWED_ROLES,
                },
            )


def unseed_website_permissions(apps, schema_editor):
    ModulePermission = apps.get_model('users', 'ModulePermission')
    ModulePermission.objects.filter(module_key=WEBSITE_MODULE_KEY).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('website', '0001_initial'),
        ('tenants', '0002_create_default_restaurant_and_backfill'),
        ('users', '0016_alter_modulepermission_unique_together_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_website_permissions, unseed_website_permissions),
    ]
