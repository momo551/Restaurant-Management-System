"""
Migration-safety tests for the multi-tenancy backfill.

Background
----------
The tenant migration set adds a `restaurant` FK plus a *composite* UNIQUE
constraint to six models, while the legacy schema carried *global* UNIQUE
constraints on the same business fields. `AlterField` drops the global index and
`AlterUniqueTogether` adds the composite one -- but for legacy rows
`restaurant_id` is still NULL, and SQL treats NULLs as distinct, so the new
constraint is NOT enforced at that moment. Duplicates can therefore exist
unnoticed, and the backfill (`tenants/0002`) that assigns every unassigned row to
one default restaurant would then raise `UniqueViolation` after the old global
constraints were already dropped.

`tenants/0002` now runs a preflight (`preflight_unassigned_rows`) that detects
that situation and aborts with an actionable diagnostic BEFORE the first UPDATE,
inside the migration transaction.

These tests roll the schema back to the pre-tenant leaves and step forward with
`MigrationExecutor`, so they observe real intermediate migration states on the
project's configured database engine (PostgreSQL locally).

Everything runs inside Django's disposable test database.
"""

import importlib
import os
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

M0002 = "tenants.migrations.0002_create_default_restaurant_and_backfill"

# Pre-tenant leaf for every app touched by the tenant migration set.
PRE_TENANT = [
    ("users", "0015_alter_modulepermission_role_alter_user_role"),
    ("menu", "0004_productoffer_name"),
    ("tables", "0004_qrcode_tablesession"),
    ("orders", "0019_order_loyalty_processed"),
    ("stock", "0006_wastelog_lowstockalert"),
    ("loyalty", "0003_alter_loyaltypoint_options"),
    ("reports", "0001_initial"),
]

# Just before the backfill: every AddField + composite UNIQUE is in place,
# restaurant_id is NULL everywhere, and tenants/0002 has not run yet.
BEFORE_BACKFILL = PRE_TENANT + [
    ("tenants", "0001_initial"),
    ("users", "0016_alter_modulepermission_unique_together_and_more"),
    ("menu", "0005_category_restaurant"),
    ("tables", "0005_table_restaurant_alter_table_number_and_more"),
    ("stock", "0007_ingredient_restaurant_supplier_restaurant"),
    ("loyalty", "0004_campaign_restaurant_coupon_restaurant_and_more"),
    ("reports", "0002_dailyclosingreport_restaurant_and_more"),
    ("orders", "0020_order_restaurant_alter_order_order_number_and_more"),
]

AFTER_BACKFILL = ("tenants", "0002_create_default_restaurant_and_backfill")


class TenantMigrationSafetyTests(TransactionTestCase):
    """Exercise the real migration sequence against legacy data shapes."""

    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)

    def _apps(self, node):
        return MigrationExecutor(connection).loader.project_state([node]).apps

    def _apps_before_backfill(self):
        """Model state with every pre-backfill migration applied (all apps)."""
        return MigrationExecutor(connection).loader.project_state(BEFORE_BACKFILL).apps

    def _roll_to_pre_backfill(self):
        """Unapply tenant work entirely, then step up to just before the backfill."""
        self._migrate(PRE_TENANT)
        self._migrate(BEFORE_BACKFILL)
        return self._apps_before_backfill()

    # ------------------------------------------------------------------ #
    # 1. Empty legacy database
    # ------------------------------------------------------------------ #
    def test_empty_legacy_database(self):
        """Fresh/empty data: backfill creates exactly the default restaurant."""
        apps_before = self._roll_to_pre_backfill()
        self.assertEqual(apps_before.get_model("orders", "Order").objects.count(), 0)

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        Restaurant = apps_after.get_model("tenants", "Restaurant")
        self.assertEqual(Restaurant.objects.count(), 1)
        self.assertEqual(Restaurant.objects.get().slug, "main-branch")

    # ------------------------------------------------------------------ #
    # 2. Records with NULL restaurant assignment
    # ------------------------------------------------------------------ #
    def test_null_restaurant_rows_are_backfilled(self):
        apps = self._roll_to_pre_backfill()
        Order = apps.get_model("orders", "Order")
        Table = apps.get_model("tables", "Table")
        Order.objects.create(order_number="SAFE-001", total=Decimal("10"))
        Order.objects.create(order_number="SAFE-002", total=Decimal("20"))
        Table.objects.create(number=1)
        Table.objects.create(number=2)

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        NewOrder = apps_after.get_model("orders", "Order")
        NewTable = apps_after.get_model("tables", "Table")
        self.assertEqual(NewOrder.objects.filter(restaurant__isnull=True).count(), 0)
        self.assertEqual(NewTable.objects.filter(restaurant__isnull=True).count(), 0)
        self.assertEqual(NewOrder.objects.count(), 2)

    # ------------------------------------------------------------------ #
    # 3-6. Duplicates that the composite UNIQUE would reject
    # ------------------------------------------------------------------ #
    def _assert_preflight_aborts(self, seed):
        """Seed a conflict, then assert the backfill aborts with a diagnostic."""
        apps = self._roll_to_pre_backfill()
        seed(apps)

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)

        with self.assertRaises(RuntimeError) as ctx:
            mod.backfill_default_restaurant(apps_after, None)

        message = str(ctx.exception)
        self.assertIn("preflight validation", message)
        self.assertIn(M0002.split(".")[-1] and "composite UNIQUE", message)

        # Aborting must not have assigned anything or created the tenant.
        Restaurant = apps_after.get_model("tenants", "Restaurant")
        self.assertEqual(Restaurant.objects.count(), 0, "abort must not mutate data")
        return message

    def test_duplicate_order_numbers_abort_backfill(self):
        """Duplicate Order.order_number among NULL-tenant rows is detected."""
        def seed(apps):
            Order = apps.get_model("orders", "Order")
            Order.objects.create(order_number="DUP-001", total=Decimal("1"))
            Order.objects.create(order_number="DUP-001", total=Decimal("2"))

        message = self._assert_preflight_aborts(seed)
        self.assertIn("Order.order_number", message)

    def test_duplicate_table_numbers_abort_backfill(self):
        """Duplicate Table.number among NULL-tenant rows is detected."""
        def seed(apps):
            Table = apps.get_model("tables", "Table")
            Table.objects.create(number=7)
            Table.objects.create(number=7)

        message = self._assert_preflight_aborts(seed)
        self.assertIn("Table.number", message)

    def test_duplicate_coupon_codes_abort_backfill(self):
        """Duplicate Coupon.code among NULL-tenant rows is detected."""
        def seed(apps):
            Coupon = apps.get_model("loyalty", "Coupon")
            Coupon.objects.create(
                code="WELCOME10", discount_amount=Decimal("10"),
                valid_until=timezone.now() + timedelta(days=1),
            )
            Coupon.objects.create(
                code="WELCOME10", discount_amount=Decimal("15"),
                valid_until=timezone.now() + timedelta(days=1),
            )

        message = self._assert_preflight_aborts(seed)
        self.assertIn("Coupon.code", message)

    def test_duplicate_customer_phones_abort_backfill(self):
        """Duplicate Customer.phone among NULL-tenant rows is detected."""
        def seed(apps):
            Customer = apps.get_model("loyalty", "Customer")
            Customer.objects.create(name="A", phone="01000000001")
            Customer.objects.create(name="B", phone="01000000001")

        message = self._assert_preflight_aborts(seed)
        self.assertIn("Customer.phone", message)

    # ------------------------------------------------------------------ #
    # 7. Data that already belongs to multiple / existing restaurants
    # ------------------------------------------------------------------ #
    def test_existing_tenant_rows_are_left_untouched(self):
        """Rows that already carry a restaurant must not be reassigned."""
        apps = self._roll_to_pre_backfill()
        Restaurant = apps.get_model("tenants", "Restaurant")
        Order = apps.get_model("orders", "Order")

        existing = Restaurant.objects.create(name="Branch Two", slug="branch-two")
        assigned = Order.objects.create(
            order_number="ALREADY-001", total=Decimal("1"), restaurant=existing
        )
        unassigned = Order.objects.create(order_number="NULL-001", total=Decimal("2"))

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        NewOrder = apps_after.get_model("orders", "Order")
        NewRestaurant = apps_after.get_model("tenants", "Restaurant")

        # The pre-existing tenant keeps its row...
        assigned_after = NewOrder.objects.get(pk=assigned.pk)
        self.assertEqual(assigned_after.restaurant_id, existing.pk)
        # ...and the unassigned row goes to the default tenant.
        unassigned_after = NewOrder.objects.get(pk=unassigned.pk)
        default = NewRestaurant.objects.get(slug="main-branch")
        self.assertEqual(unassigned_after.restaurant_id, default.pk)
        # Both restaurants coexist.
        self.assertEqual(NewRestaurant.objects.count(), 2)

    # ------------------------------------------------------------------ #
    # 8. Successful migration with valid legacy data
    # ------------------------------------------------------------------ #
    def test_valid_legacy_data_migrates_cleanly(self):
        apps = self._roll_to_pre_backfill()
        Order = apps.get_model("orders", "Order")
        Table = apps.get_model("tables", "Table")
        Coupon = apps.get_model("loyalty", "Coupon")
        Customer = apps.get_model("loyalty", "Customer")

        for i in range(1, 4):
            Order.objects.create(order_number=f"OK-{i:03d}", total=Decimal(i))
            Table.objects.create(number=i)
            Coupon.objects.create(
                code=f"CODE{i}", discount_amount=Decimal("5"),
                valid_until=timezone.now() + timedelta(days=1),
            )
            Customer.objects.create(name=f"C{i}", phone=f"0100000000{i}")

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        for model_name in ("Order", "Table", "Coupon", "Customer"):
            model = apps_after.get_model(
                {"Order": "orders", "Table": "tables", "Coupon": "loyalty",
                 "Customer": "loyalty"}[model_name], model_name
            )
            self.assertEqual(
                model.objects.filter(restaurant__isnull=True).count(), 0,
                f"{model_name} still has unassigned rows",
            )
            self.assertEqual(model.objects.count(), 3, f"{model_name} row count changed")

    # ------------------------------------------------------------------ #
    # 9. Idempotency
    # ------------------------------------------------------------------ #
    def test_backfill_is_idempotent(self):
        """Running the backfill twice must not duplicate the default tenant."""
        apps = self._roll_to_pre_backfill()
        apps.get_model("orders", "Order").objects.create(
            order_number="IDEM-001", total=Decimal("1")
        )

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)
        mod.backfill_default_restaurant(apps_after, None)

        Restaurant = apps_after.get_model("tenants", "Restaurant")
        self.assertEqual(Restaurant.objects.count(), 1)
        self.assertEqual(Restaurant.objects.get().slug, "main-branch")

    # ------------------------------------------------------------------ #
    # 10. Explicit operator override
    # ------------------------------------------------------------------ #
    def test_operator_can_override_preflight_explicitly(self):
        """With the documented env flag set, conflicts no longer abort."""
        apps = self._roll_to_pre_backfill()
        Order = apps.get_model("orders", "Order")
        Order.objects.create(order_number="OVERRIDE-001", total=Decimal("1"))
        Order.objects.create(order_number="OVERRIDE-001", total=Decimal("2"))

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)

        with mock.patch.dict(os.environ, {mod.ALLOW_UNMAPPED_ENV: "1"}):
            # Backfill proceeds; the duplicate now violates the composite UNIQUE,
            # which is exactly why the preflight exists and must be documented.
            with self.assertRaises(Exception) as ctx:
                mod.backfill_default_restaurant(apps_after, None)
            self.assertNotIn("preflight validation", str(ctx.exception))

    # ------------------------------------------------------------------ #
    # 11. Reverse behaviour (documented, deliberately not auto-reversible)
    # ------------------------------------------------------------------ #
    def test_reverse_backfill_is_a_documented_no_op(self):
        """The backfill must not pretend to be reversible."""
        mod = importlib.import_module(M0002)
        before = {
            "Order": (1,), "Table": (2,),
        }
        Result = self._roll_to_pre_backfill()
        Result.get_model("orders", "Order").objects.create(
            order_number="REV-001", total=Decimal("1")
        )
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        NewOrder = apps_after.get_model("orders", "Order")
        self.assertEqual(NewOrder.objects.filter(restaurant__isnull=True).count(), 0)

        # The reverse function intentionally does nothing.
        mod.reverse_backfill(apps_after, None)
        self.assertEqual(
            NewOrder.objects.filter(restaurant__isnull=True).count(), 0,
            "reverse is documented as a no-op; assignments are NOT restored",
        )
        self.assertIsNotNone(before)

    # ------------------------------------------------------------------ #
    # 12. Tenant isolation after a successful migration
    # ------------------------------------------------------------------ #
    def test_tenant_isolation_holds_after_migration(self):
        """Two tenants may legitimately share business identifiers."""
        apps = self._roll_to_pre_backfill()
        Restaurant = apps.get_model("tenants", "Restaurant")
        Order = apps.get_model("orders", "Order")
        Table = apps.get_model("tables", "Table")

        r1 = Restaurant.objects.create(name="One", slug="one")
        r2 = Restaurant.objects.create(name="Two", slug="two")
        r1_id, r2_id = r1.pk, r2.pk
        Order.objects.create(order_number="SHARED-001", total=Decimal("1"), restaurant=r1)
        Order.objects.create(order_number="SHARED-001", total=Decimal("2"), restaurant=r2)
        Table.objects.create(number=5, restaurant=r1)
        Table.objects.create(number=5, restaurant=r2)

        mod = importlib.import_module(M0002)
        apps_after = self._apps(AFTER_BACKFILL)
        mod.backfill_default_restaurant(apps_after, None)

        NewOrder = apps_after.get_model("orders", "Order")
        NewTable = apps_after.get_model("tables", "Table")

        self.assertEqual(NewOrder.objects.filter(order_number="SHARED-001").count(), 2)
        self.assertEqual(NewOrder.objects.filter(restaurant_id=r1_id).count(), 1)
        self.assertEqual(NewOrder.objects.filter(restaurant_id=r2_id).count(), 1)
        self.assertEqual(NewTable.objects.filter(number=5).count(), 2)


class LegacyGlobalConstraintTests(TransactionTestCase):
    """
    Documents the constraint transition that makes the preflight necessary.

    These assert the *schema* facts the remediation is based on, so a future
    migration change that alters them will fail loudly here.
    """

    def _migrate(self, targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)

    def _unique_constraints(self, table):
        if connection.vendor != "postgresql":
            self.skipTest("constraint introspection implemented for PostgreSQL only")
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = %s AND con.contype = 'u'
                """,
                [table],
            )
            return [r[0] for r in cur.fetchall()]

    def test_legacy_schema_had_global_unique_order_number(self):
        self._migrate(PRE_TENANT)
        names = self._unique_constraints("orders_order")
        self.assertTrue(
            any("order_number" in n and "restaurant" not in n for n in names),
            f"expected a legacy global UNIQUE on order_number, got {names}",
        )

    def test_composite_constraint_is_unenforced_for_null_restaurant(self):
        """
        Before the backfill, duplicate identifiers with restaurant_id = NULL are
        accepted by the database -- the situation the preflight guards against.
        """
        self._migrate(PRE_TENANT)
        self._migrate(BEFORE_BACKFILL)
        apps = MigrationExecutor(connection).loader.project_state(
            [BEFORE_BACKFILL[-1]]
        ).apps

        Order = apps.get_model("orders", "Order")
        Order.objects.create(order_number="NULL-DUP", total=Decimal("1"))
        Order.objects.create(order_number="NULL-DUP", total=Decimal("2"))
        self.assertEqual(
            Order.objects.filter(
                order_number="NULL-DUP", restaurant__isnull=True
            ).count(),
            2,
        )
