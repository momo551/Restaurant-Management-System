import os

from django.db import migrations
from django.db.models import Count

# Escape hatch for operators who have already audited their legacy data and have
# confirmed that every unassigned row belongs to the single default restaurant.
ALLOW_UNMAPPED_ENV = "TENANT_BACKFILL_ASSUME_SINGLE_TENANT"

# Every composite UNIQUE the tenant migration set introduces. While legacy rows
# still have restaurant_id = NULL these constraints are NOT enforced (SQL treats
# NULLs as distinct), so duplicates can exist unnoticed. Assigning all of them to
# one restaurant afterwards raises UniqueViolation *inside* this backfill -- after
# the legacy global UNIQUE constraints have already been dropped. The preflight
# below converts that opaque crash into an actionable, data-free diagnostic.
TENANT_UNIQUE_CHECKS = [
    ('orders', 'Order', ('order_number',), 'Order.order_number'),
    ('tables', 'Table', ('number',), 'Table.number'),
    ('loyalty', 'Coupon', ('code',), 'Coupon.code'),
    ('loyalty', 'Customer', ('phone',), 'Customer.phone'),
    ('reports', 'DailyClosingReport', ('date',), 'DailyClosingReport.date'),
    ('users', 'ModulePermission', ('role', 'module_key'),
     'ModulePermission(role, module_key)'),
]


def find_unassigned_duplicates(apps):
    """Return [(label, duplicate_group_count)] for NULL-tenant rows that collide.

    Reports field labels and group counts only -- never row values -- so the
    diagnostic is safe to paste into an issue tracker.
    """
    conflicts = []
    for app_label, model_name, fields, label in TENANT_UNIQUE_CHECKS:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            # App not present in this migration state; nothing to validate.
            continue

        unassigned = model.objects.filter(restaurant__isnull=True)
        if not unassigned.exists():
            continue

        duplicate_groups = (
            unassigned.values(*fields)
            .annotate(row_count=Count('id'))
            .filter(row_count__gt=1)
            .count()
        )
        if duplicate_groups:
            conflicts.append((label, duplicate_groups))
    return conflicts


def preflight_unassigned_rows(apps):
    """Fail loudly BEFORE the first UPDATE if legacy data cannot be backfilled.

    Runs inside the migration transaction, so a conflict leaves the database
    exactly as it was rather than half-migrated.
    """
    if os.environ.get(ALLOW_UNMAPPED_ENV, '').strip().lower() in ('1', 'true', 'yes'):
        return

    conflicts = find_unassigned_duplicates(apps)
    if not conflicts:
        return

    detail = '; '.join(
        '{0}: {1} duplicate value group(s)'.format(label, count)
        for label, count in conflicts
    )
    raise RuntimeError(
        "Tenant backfill aborted by preflight validation. Rows that still have "
        "no restaurant assignment contain duplicate values for fields that become "
        "per-restaurant unique: {0}. Assigning them all to the same restaurant "
        "would violate the new composite UNIQUE constraints and abort the "
        "migration. Resolve these duplicates first (see the tenant migration "
        "runbook). Only if you have verified that every unassigned row belongs to "
        "a single tenant, re-run with {1}=1 to skip this check.".format(
            detail, ALLOW_UNMAPPED_ENV
        )
    )


def backfill_default_restaurant(apps, schema_editor):
    Restaurant = apps.get_model('tenants', 'Restaurant')
    User = apps.get_model('users', 'User')
    ModulePermission = apps.get_model('users', 'ModulePermission')
    Category = apps.get_model('menu', 'Category')
    Table = apps.get_model('tables', 'Table')
    Order = apps.get_model('orders', 'Order')
    Ingredient = apps.get_model('stock', 'Ingredient')
    Supplier = apps.get_model('stock', 'Supplier')
    Customer = apps.get_model('loyalty', 'Customer')
    Campaign = apps.get_model('loyalty', 'Campaign')
    Coupon = apps.get_model('loyalty', 'Coupon')
    DailyClosingReport = apps.get_model('reports', 'DailyClosingReport')

    # 0. Refuse to continue if legacy data cannot be backfilled safely.
    preflight_unassigned_rows(apps)

    # 1. Get or create default restaurant
    default_restaurant, _ = Restaurant.objects.get_or_create(
        slug='main-branch',
        defaults={
            'name': 'المطعم الرئيسي',
            'phone': '01000000000',
            'address': 'الفرع الرئيسي',
            'is_active': True,
        }
    )

    # 2. Backfill all unassigned rows across all models
    User.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    ModulePermission.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Category.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Table.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Order.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Ingredient.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Supplier.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Customer.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Campaign.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    Coupon.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)
    DailyClosingReport.objects.filter(restaurant__isnull=True).update(restaurant=default_restaurant)


def reverse_backfill(apps, schema_editor):
    """Deliberately a no-op: this backfill is IRREVERSIBLE.

    The original NULL / non-NULL restaurant assignment of every legacy row is not
    recorded anywhere, so it cannot be reconstructed. Reversing this migration
    therefore leaves:
      * the `main-branch` Restaurant row in place, and
      * `restaurant_id` populated on every previously unassigned row
    while the dependent AddField migrations drop the `restaurant` columns again.
    That is a documented "do not roll back past this point" boundary, not a bug.

    Recovery from a failed/aborted migrate is therefore: restore the pre-migration
    backup. Do NOT use `migrate tenants 0001` as a rollback strategy.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('users', '0016_alter_modulepermission_unique_together_and_more'),
        ('menu', '0005_category_restaurant'),
        ('tables', '0005_table_restaurant_alter_table_number_and_more'),
        ('orders', '0020_order_restaurant_alter_order_order_number_and_more'),
        ('stock', '0007_ingredient_restaurant_supplier_restaurant'),
        ('loyalty', '0004_campaign_restaurant_coupon_restaurant_and_more'),
        ('reports', '0002_dailyclosingreport_restaurant_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_default_restaurant, reverse_backfill),
    ]
