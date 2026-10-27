"""
Regression tests for tenant (restaurant) context on order creation.

These tests pin down the rule behind:
    {"restaurant": "Restaurant context is required for order creation"}

The rule is:

* the public website endpoint (/api/public/<slug>/orders/) takes the tenant from
  the URL slug only;
* the QR endpoint (/api/orders/customer_order/) takes the tenant from the table
  session only;
* the staff/POS endpoint (POST /api/orders/) takes the tenant from the
  authenticated user only;
* client supplied ``restaurant`` / ``restaurant_id`` values are read-only and are
  silently ignored, never trusted;
* no code path may persist an order without a restaurant.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APIClient

from loyalty.models import Coupon
from menu.models import Category, MenuItem
from orders.models import DailyOrderSequence, Order, OrderAuditLog, OrderItem
from stock.models import Ingredient, Recipe
from tables.models import Table, TableSession
from tenants.models import Restaurant
from users.models import ModulePermission

User = get_user_model()


class RestaurantContextOrderCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.restaurant_a = Restaurant.objects.create(
            name="Alpha", slug="alpha", is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Beta", slug="beta", is_active=True
        )
        self.inactive = Restaurant.objects.create(
            name="Closed", slug="closed", is_active=False
        )

        self.cat_a = Category.objects.create(
            name="Burgers", restaurant=self.restaurant_a, is_active=True
        )
        self.item_a = MenuItem.objects.create(
            category=self.cat_a, name="Burger A", price=Decimal("100.00")
        )
        self.cat_b = Category.objects.create(
            name="Pizza", restaurant=self.restaurant_b, is_active=True
        )
        self.item_b = MenuItem.objects.create(
            category=self.cat_b, name="Pizza B", price=Decimal("70.00")
        )

        self.coupon_a = Coupon.objects.create(
            restaurant=self.restaurant_a,
            code="ALPHA10",
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal("10.00"),
            min_purchase=Decimal("0.00"),
            is_active=True,
            valid_until=timezone.now() + timezone.timedelta(days=5),
        )
        self.coupon_b = Coupon.objects.create(
            restaurant=self.restaurant_b,
            code="BETA25",
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal("25.00"),
            min_purchase=Decimal("0.00"),
            is_active=True,
            valid_until=timezone.now() + timezone.timedelta(days=5),
        )

        # Mirrors create_default_users / create_admin: the seeded "admin" account
        # is an is_superuser=True user that still belongs to a restaurant.
        self.superuser_with_restaurant = User.objects.create_user(
            username="admin_super",
            password="x-pass-12345",
            role="owner",
            is_staff=True,
            is_superuser=True,
            restaurant=self.restaurant_a,
        )
        # A superuser that is not linked to any tenant (platform level account).
        self.superuser_without_restaurant = User.objects.create_user(
            username="admin_platform",
            password="x-pass-12345",
            role="owner",
            is_staff=True,
            is_superuser=True,
            restaurant=None,
        )
        self.owner_a = User.objects.create_user(
            username="owner_a",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant_a,
        )
        self.owner_without_restaurant = User.objects.create_user(
            username="owner_no_tenant",
            password="x-pass-12345",
            role="owner",
            restaurant=None,
        )
        self.cashier_a = User.objects.create_user(
            username="cashier_a",
            password="x-pass-12345",
            role="cashier",
            restaurant=self.restaurant_a,
        )
        ModulePermission.objects.create(
            restaurant=self.restaurant_a,
            role="cashier",
            module_key="pos",
            module_label="POS",
            allowed=True,
        )

        self.table_a = Table.objects.create(
            number=1, restaurant=self.restaurant_a, capacity=4
        )
        self.table_session_a = TableSession.objects.create(
            table=self.table_a, session_token="qr-session-alpha", is_active=True
        )

    # ------------------------------------------------------------------ helpers

    def _public_payload(self, **overrides):
        payload = {
            "customer_name": "Public Guest",
            "customer_phone": "01011112222",
            "order_type": "takeaway",
            "items": [{"menu_item": self.item_a.id, "quantity": 1}],
        }
        payload.update(overrides)
        return payload

    def _staff_payload(self, item=None, **overrides):
        payload = {
            "customer_name": "Walk-in",
            "customer_phone": "01099998888",
            "order_type": "takeaway",
            "items": [{"menu_item": (item or self.item_a).id, "quantity": 1}],
        }
        payload.update(overrides)
        return payload

    # ------------------------------------------------------- public (URL slug)

    def test_public_order_uses_url_restaurant(self):
        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)
        self.assertEqual(order.daily_id, 1)
        self.assertEqual(
            order.order_number,
            f"ORD-{timezone.localdate().strftime('%Y%m%d')}-001",
        )

    def test_public_order_rejects_unknown_slug(self):
        response = self.client.post(
            "/api/public/does-not-exist/orders/",
            self._public_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Order.objects.count(), 0)

    def test_public_order_rejects_inactive_restaurant(self):
        response = self.client.post(
            f"/api/public/{self.inactive.slug}/orders/",
            self._public_payload(),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Order.objects.count(), 0)

    def test_public_order_ignores_client_supplied_restaurant(self):
        payload = self._public_payload(
            restaurant=self.restaurant_b.id,
            restaurant_id=self.restaurant_b.id,
            restaurant_slug=self.restaurant_b.slug,
        )
        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/", payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)

    def test_public_order_rejects_items_from_another_restaurant(self):
        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(
                items=[{"menu_item": self.item_b.id, "quantity": 1}]
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_public_order_rejects_coupon_from_another_restaurant(self):
        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(coupon_code=self.coupon_b.code),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coupon_code", response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_public_order_rejects_dine_in(self):
        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(order_type="dine_in"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    # ------------------------------------------------------- QR (table session)

    def test_qr_order_uses_table_session_restaurant(self):
        response = self.client.post(
            "/api/orders/customer_order/",
            {
                "session_token": self.table_session_a.session_token,
                "customer_name": "QR Guest",
                "customer_phone": "01033334444",
                "items": [{"menu_item": self.item_a.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)
        self.assertEqual(order.order_type, Order.OrderType.DINE_IN)
        self.assertEqual(order.table_session, self.table_session_a)

    def test_qr_order_rejects_restaurant_slug_mismatch(self):
        response = self.client.post(
            "/api/orders/customer_order/",
            {
                "session_token": self.table_session_a.session_token,
                "restaurant_slug": self.restaurant_b.slug,
                "customer_phone": "01033334444",
                "items": [{"menu_item": self.item_a.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_qr_order_rejects_items_from_another_restaurant(self):
        response = self.client.post(
            "/api/orders/customer_order/",
            {
                "session_token": self.table_session_a.session_token,
                "customer_phone": "01033334444",
                "items": [{"menu_item": self.item_b.id, "quantity": 1}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    # --------------------------------------------------------------- staff/POS

    def test_staff_order_uses_authenticated_user_restaurant(self):
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)

    def test_staff_order_ignores_client_supplied_restaurant(self):
        self.client.force_authenticate(user=self.owner_a)
        response = self.client.post(
            "/api/orders/",
            self._staff_payload(
                restaurant=self.restaurant_b.id,
                restaurant_id=self.restaurant_b.id,
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)

    def test_superuser_with_restaurant_creates_order_in_own_restaurant(self):
        """
        Production account shape created by create_default_users/create_admin:
        is_superuser=True AND restaurant assigned. Such a user must be able to
        open an order, and the order must be tenant-scoped.
        """
        self.client.force_authenticate(user=self.superuser_with_restaurant)
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            msg=f"order creation failed with {response.data!r}",
        )
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)
        self.assertEqual(order.daily_id, 1)

    def test_user_without_restaurant_cannot_create_order(self):
        self.client.force_authenticate(user=self.owner_without_restaurant)
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("restaurant", response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_superuser_without_restaurant_cannot_create_order(self):
        self.client.force_authenticate(user=self.superuser_without_restaurant)
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("restaurant", response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_unauthenticated_staff_endpoint_is_not_public(self):
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )
        self.assertEqual(Order.objects.count(), 0)

    # ------------------------------------------------------- daily sequence

    def test_daily_ids_are_per_restaurant_per_day(self):
        payload_b = {
            "customer_name": "Beta Guest",
            "customer_phone": "01022223333",
            "order_type": "takeaway",
            "items": [{"menu_item": self.item_b.id, "quantity": 1}],
        }
        first_a = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(),
            format="json",
        )
        second_a = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._public_payload(customer_phone="01011113333"),
            format="json",
        )
        first_b = self.client.post(
            f"/api/public/{self.restaurant_b.slug}/orders/", payload_b, format="json"
        )

        self.assertEqual(first_a.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_a.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first_b.status_code, status.HTTP_201_CREATED)

        today = timezone.localdate()
        self.assertEqual(
            DailyOrderSequence.objects.get(
                restaurant=self.restaurant_a, date=today
            ).last_daily_id,
            2,
        )
        self.assertEqual(
            DailyOrderSequence.objects.get(
                restaurant=self.restaurant_b, date=today
            ).last_daily_id,
            1,
        )
        self.assertEqual(
            Order.objects.filter(restaurant=self.restaurant_a).count(), 2
        )
        self.assertEqual(
            Order.objects.filter(restaurant=self.restaurant_b).count(), 1
        )

    def test_cashier_with_pos_permission_creates_order_in_own_restaurant(self):
        self.client.force_authenticate(user=self.cashier_a)
        response = self.client.post(
            "/api/orders/", self._staff_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)


class MenuItemTenantIsolationAndStockTests(TestCase):
    """
    Server-side ownership of order lines and tenant-scoped stock validation.

    A request must never be able to order a product that belongs to another
    restaurant, whichever entry point it uses (POS, public website, QR, edit),
    and stock must always be checked against the order's own tenant only.
    """

    def setUp(self):
        self.client = APIClient()

        self.restaurant_a = Restaurant.objects.create(
            name="Alpha Stock", slug="alpha-stock", is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Beta Stock", slug="beta-stock", is_active=True
        )

        self.cat_a = Category.objects.create(
            name="Burgers", restaurant=self.restaurant_a, is_active=True
        )
        self.cat_b = Category.objects.create(
            name="Pizza", restaurant=self.restaurant_b, is_active=True
        )
        self.item_a = MenuItem.objects.create(
            category=self.cat_a, name="Burger A", price=Decimal("100.00")
        )
        self.item_b = MenuItem.objects.create(
            category=self.cat_b, name="Pizza B", price=Decimal("70.00")
        )

        # 2 units of the ingredient are consumed per ordered unit.
        self.ingredient_a = Ingredient.objects.create(
            restaurant=self.restaurant_a,
            name="Beef A",
            unit="kg",
            quantity=Decimal("3.000"),
        )
        self.ingredient_b = Ingredient.objects.create(
            restaurant=self.restaurant_b,
            name="Cheese B",
            unit="kg",
            quantity=Decimal("1000.000"),
        )
        Recipe.objects.create(
            menu_item=self.item_a,
            ingredient=self.ingredient_a,
            quantity_required=Decimal("2.000"),
        )
        Recipe.objects.create(
            menu_item=self.item_b,
            ingredient=self.ingredient_b,
            quantity_required=Decimal("2.000"),
        )

        self.owner_a = User.objects.create_user(
            username="owner_stock_a",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant_a,
        )
        self.superuser_a = User.objects.create_user(
            username="admin_stock",
            password="x-pass-12345",
            role="owner",
            is_staff=True,
            is_superuser=True,
            restaurant=self.restaurant_a,
        )

    def _payload(self, item, quantity=1, **overrides):
        payload = {
            "customer_name": "Stock Guest",
            "customer_phone": "01000000001",
            "order_type": "takeaway",
            "items": [{"menu_item": item.id, "quantity": quantity}],
        }
        payload.update(overrides)
        return payload

    # ------------------------------------------------------- own tenant works

    def test_pos_order_with_own_product_succeeds_and_deducts_own_stock(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.post(
            "/api/orders/", self._payload(self.item_a), format="json"
        )

        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, msg=response.data
        )
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)
        self.ingredient_a.refresh_from_db()
        self.ingredient_b.refresh_from_db()
        self.assertEqual(self.ingredient_a.quantity, Decimal("1.000"))
        self.assertEqual(self.ingredient_b.quantity, Decimal("1000.000"))

    # ------------------------------------------------- foreign tenant's items

    def test_pos_order_rejects_foreign_product_without_partial_write(self):
        self.client.force_authenticate(user=self.owner_a)
        first = self.client.post(
            "/api/orders/", self._payload(self.item_a), format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        today = timezone.localdate()
        sequence = DailyOrderSequence.objects.get(
            restaurant=self.restaurant_a, date=today
        )
        self.assertEqual(sequence.last_daily_id, 1)
        orders_before = Order.objects.count()
        items_before = OrderItem.objects.count()

        response = self.client.post(
            "/api/orders/", self._payload(self.item_b), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)
        self.assertEqual(Order.objects.count(), orders_before)
        self.assertEqual(OrderItem.objects.count(), items_before)
        sequence.refresh_from_db()
        self.assertEqual(sequence.last_daily_id, 1)
        self.ingredient_a.refresh_from_db()
        self.ingredient_b.refresh_from_db()
        self.assertEqual(self.ingredient_a.quantity, Decimal("1.000"))
        self.assertEqual(self.ingredient_b.quantity, Decimal("1000.000"))

    def test_superuser_with_restaurant_cannot_inject_foreign_product(self):
        self.client.force_authenticate(user=self.superuser_a)

        response = self.client.post(
            "/api/orders/", self._payload(self.item_b), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)

    def test_pos_order_rejects_coupon_from_another_restaurant(self):
        coupon_b = Coupon.objects.create(
            restaurant=self.restaurant_b,
            code="BETAONLY",
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal("5.00"),
            min_purchase=Decimal("0.00"),
            is_active=True,
            valid_until=timezone.now() + timezone.timedelta(days=5),
        )
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.post(
            "/api/orders/",
            self._payload(self.item_a, coupon_code=coupon_b.code),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("coupon_code", response.data)
        self.assertEqual(Order.objects.count(), 0)
        coupon_b.refresh_from_db()
        self.assertIsNone(coupon_b.used_at)

    def test_fake_restaurant_payload_does_not_authorise_foreign_product(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.post(
            "/api/orders/",
            self._payload(
                self.item_b,
                restaurant=self.restaurant_b.id,
                restaurant_id=self.restaurant_b.id,
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("items", response.data)
        self.assertEqual(Order.objects.count(), 0)

    # ------------------------------------------------------ stock validation

    def test_insufficient_stock_in_own_restaurant_blocks_order(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.post(
            "/api/orders/", self._payload(self.item_a, quantity=2), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)
        self.ingredient_a.refresh_from_db()
        self.ingredient_b.refresh_from_db()
        self.assertEqual(self.ingredient_a.quantity, Decimal("3.000"))
        self.assertEqual(self.ingredient_b.quantity, Decimal("1000.000"))

    def test_stock_validation_ignores_other_tenants_ingredients(self):
        # Corrupted cross-tenant recipe: a restaurant A item consuming a
        # restaurant B ingredient. Enriching tenant B must not satisfy the check.
        bad_recipe = Recipe.objects.create(
            menu_item=self.item_a,
            ingredient=self.ingredient_b,
            quantity_required=Decimal("1.000"),
        )
        self.ingredient_a.quantity = Decimal("10.000")
        self.ingredient_a.save()

        self.client.force_authenticate(user=self.owner_a)
        response = self.client.post(
            "/api/orders/", self._payload(self.item_a), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertEqual(Order.objects.count(), 0)

        # With the corrupted recipe removed the same order is accepted.
        bad_recipe.delete()
        accepted = self.client.post(
            "/api/orders/", self._payload(self.item_a), format="json"
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)

    def test_public_order_stock_validation_is_tenant_scoped(self):
        Recipe.objects.create(
            menu_item=self.item_a,
            ingredient=self.ingredient_b,
            quantity_required=Decimal("1.000"),
        )
        self.ingredient_a.quantity = Decimal("10.000")
        self.ingredient_a.save()

        response = self.client.post(
            f"/api/public/{self.restaurant_a.slug}/orders/",
            self._payload(self.item_a),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertEqual(Order.objects.count(), 0)

    # ----------------------------------------------------------- edit path

    def test_edit_endpoint_rejects_foreign_product(self):
        self.client.force_authenticate(user=self.owner_a)
        created = self.client.post(
            "/api/orders/", self._payload(self.item_a), format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        order_id = created.data["id"]

        response = self.client.patch(
            f"/api/orders/{order_id}/edit/",
            {"items": [{"menu_item": self.item_b.id, "quantity": 1}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().menu_item, self.item_a)


class OrderEditTenantIsolationTests(TestCase):
    """
    Regression tests for cross-tenant authorization on ``PATCH /api/orders/<pk>/edit/``.

    Policy enforced by ``OrderViewSet.get_editable_orders()`` (and consistent with
    ``get_queryset()`` and the other order actions):
      * staff of a restaurant may only edit orders of that restaurant;
      * a staff account without a restaurant cannot edit anything;
      * platform superusers keep their existing cross-tenant access;
      * a foreign, missing or soft-deleted order is always reported as 404.
    """

    def setUp(self):
        self.client = APIClient()

        self.restaurant_a = Restaurant.objects.create(
            name="Alpha Edit", slug="alpha-edit", is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Beta Edit", slug="beta-edit", is_active=True
        )
        self.cat_a = Category.objects.create(name="Cat A", restaurant=self.restaurant_a)
        self.cat_b = Category.objects.create(name="Cat B", restaurant=self.restaurant_b)
        self.item_a = MenuItem.objects.create(
            category=self.cat_a, name="Item A", price=Decimal("100.00")
        )
        self.item_b = MenuItem.objects.create(
            category=self.cat_b, name="Item B", price=Decimal("70.00")
        )

        # Both tenants use the same daily order number on purpose: the unique key
        # is (restaurant, order_number), so an order number alone must never be a
        # way to reach another tenant's order.
        self.order_a = Order.objects.create(
            restaurant=self.restaurant_a,
            order_number="ORD-SHARED-001",
            daily_id=1,
            order_type=Order.OrderType.TAKEAWAY,
            status=Order.Status.PENDING,
            notes="original A",
            discount_percentage=Decimal("5.00"),
        )
        OrderItem.objects.create(
            order=self.order_a,
            menu_item=self.item_a,
            quantity=1,
            unit_price=Decimal("100.00"),
        )
        self.order_b = Order.objects.create(
            restaurant=self.restaurant_b,
            order_number="ORD-SHARED-001",
            daily_id=1,
            order_type=Order.OrderType.TAKEAWAY,
            status=Order.Status.PENDING,
            notes="original B",
            discount_percentage=Decimal("5.00"),
        )
        OrderItem.objects.create(
            order=self.order_b,
            menu_item=self.item_b,
            quantity=1,
            unit_price=Decimal("70.00"),
        )

        self.owner_a = User.objects.create_user(
            username="edit_owner_a",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant_a,
        )
        self.owner_without_restaurant = User.objects.create_user(
            username="edit_owner_no_tenant",
            password="x-pass-12345",
            role="owner",
            restaurant=None,
        )
        self.cashier_a = User.objects.create_user(
            username="edit_cashier_a",
            password="x-pass-12345",
            role="cashier",
            restaurant=self.restaurant_a,
        )
        ModulePermission.objects.create(
            restaurant=self.restaurant_a,
            role="cashier",
            module_key="orders",
            module_label="Orders",
            allowed=True,
        )
        self.superuser_a = User.objects.create_user(
            username="edit_super_a",
            password="x-pass-12345",
            role="owner",
            is_staff=True,
            is_superuser=True,
            restaurant=self.restaurant_a,
        )
        self.superuser_without_restaurant = User.objects.create_user(
            username="edit_super_no_tenant",
            password="x-pass-12345",
            role="owner",
            is_staff=True,
            is_superuser=True,
            restaurant=None,
        )

    def _assert_order_b_untouched(self):
        order_b = Order.objects.get(pk=self.order_b.pk)
        self.assertEqual(order_b.notes, "original B")
        self.assertEqual(order_b.discount_percentage, Decimal("5.00"))
        self.assertFalse(order_b.is_edited)
        self.assertEqual(
            list(order_b.items.values_list("menu_item_id", flat=True)),
            [self.item_b.id],
        )
        self.assertFalse(OrderAuditLog.objects.filter(order=order_b).exists())

    # ---------------------------------------------------- allowed own tenant

    def test_staff_can_edit_order_of_own_restaurant(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/edit/",
            {"notes": "edited by A", "discount_percentage": 10},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order_a = Order.objects.get(pk=self.order_a.pk)
        self.assertEqual(order_a.notes, "edited by A")
        self.assertEqual(order_a.discount_percentage, Decimal("10.00"))
        self.assertEqual(order_a.total, Decimal("90.00"))
        self.assertTrue(OrderAuditLog.objects.filter(order=order_a).exists())

    def test_cashier_with_orders_permission_can_edit_own_restaurant_order(self):
        self.client.force_authenticate(user=self.cashier_a)

        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/edit/",
            {"notes": "edited by cashier A"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(
            Order.objects.get(pk=self.order_a.pk).notes, "edited by cashier A"
        )

    # ------------------------------------------------------- foreign tenant

    def test_staff_cannot_edit_order_of_other_restaurant(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.patch(
            f"/api/orders/{self.order_b.id}/edit/",
            {
                "notes": "hijacked",
                "discount_percentage": 50,
                "items": [{"menu_item": self.item_a.id, "quantity": 2}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self._assert_order_b_untouched()

    def test_shared_order_number_does_not_expose_other_tenant_order(self):
        self.client.force_authenticate(user=self.owner_a)
        self.assertEqual(self.order_a.order_number, self.order_b.order_number)

        response = self.client.patch(
            f"/api/orders/{self.order_b.id}/edit/",
            {"notes": "hijacked via shared number"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self._assert_order_b_untouched()

    def test_staff_without_restaurant_cannot_edit_any_order(self):
        self.client.force_authenticate(user=self.owner_without_restaurant)

        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/edit/",
            {"notes": "tenant-less edit"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        order_a = Order.objects.get(pk=self.order_a.pk)
        self.assertEqual(order_a.notes, "original A")
        self.assertEqual(order_a.discount_percentage, Decimal("5.00"))

    def test_soft_deleted_order_is_not_editable(self):
        self.client.force_authenticate(user=self.owner_a)
        Order.objects.filter(pk=self.order_a.pk).update(is_deleted=True)

        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/edit/",
            {"notes": "edit deleted order"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            Order.objects.get(pk=self.order_a.pk).notes, "original A"
        )

    def test_missing_order_returns_404(self):
        self.client.force_authenticate(user=self.owner_a)

        response = self.client.patch(
            "/api/orders/999999/edit/", {"notes": "ghost"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------- superuser policy (unchanged)

    def test_superuser_without_restaurant_keeps_platform_edit_access(self):
        """Platform superusers keep the cross-tenant edit access they had before."""
        self.client.force_authenticate(user=self.superuser_without_restaurant)

        response = self.client.patch(
            f"/api/orders/{self.order_b.id}/edit/",
            {"notes": "edited by platform admin"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(
            Order.objects.get(pk=self.order_b.pk).notes,
            "edited by platform admin",
        )

    def test_superuser_with_restaurant_keeps_platform_edit_access(self):
        self.client.force_authenticate(user=self.superuser_a)

        response = self.client.patch(
            f"/api/orders/{self.order_b.id}/edit/",
            {"notes": "edited by superuser with tenant"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        self.assertEqual(
            Order.objects.get(pk=self.order_b.pk).notes,
            "edited by superuser with tenant",
        )
