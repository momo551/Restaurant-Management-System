"""
Regression tests for the unified discount policy on order creation.

The discount rules live in ``orders.validators.parse_discount_percentage`` and are
used by both ``OrderSerializer`` (POST/PATCH /api/orders/) and the POS edit action
(PATCH /api/orders/<pk>/edit/), so creation and editing must accept/reject exactly
the same values:

    0% <= discount <= 100%, at most two decimals, finite numbers only.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APIClient

from loyalty.models import Coupon, Customer, LoyaltyPoint
from menu.models import Category, MenuItem
from orders.models import DailyOrderSequence, Order, OrderAuditLog, OrderItem
from orders.validators import parse_discount_percentage
from tenants.models import Restaurant

User = get_user_model()


class OrderCreateDiscountValidationTests(TestCase):
    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name="Create Discount Rest", slug="create-discount", is_active=True
        )
        self.category = Category.objects.create(
            name="Cat", restaurant=self.restaurant
        )
        self.item = MenuItem.objects.create(
            category=self.category, name="Item", price=Decimal("100.00")
        )
        self.owner = User.objects.create_user(
            username="create_discount_owner",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)
        # Separate client: public orders must not inherit an authenticated session.
        self.public_client = APIClient()

    # -------------------------------------------------------------- helpers

    def _create_internal(self, **extra):
        payload = {
            "customer_name": "Guest",
            "customer_phone": "01000000001",
            "order_type": "takeaway",
            "items": [{"menu_item": self.item.id, "quantity": 1}],
        }
        payload.update(extra)
        return self.client.post("/api/orders/", payload, format="json")

    def _create_public(self, **extra):
        payload = {
            "customer_name": "Public Guest",
            "customer_phone": "01000000002",
            "order_type": "takeaway",
            "items": [{"menu_item": self.item.id, "quantity": 1}],
        }
        payload.update(extra)
        return self.public_client.post(
            f"/api/public/{self.restaurant.slug}/orders/", payload, format="json"
        )

    def _assert_nothing_created(self):
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)
        self.assertEqual(DailyOrderSequence.objects.count(), 0)
        self.assertEqual(LoyaltyPoint.objects.count(), 0)
        self.assertEqual(Customer.objects.count(), 0)
        self.assertEqual(OrderAuditLog.objects.count(), 0)

    # ------------------------------------------------- accepted on creation

    def test_staff_create_accepts_zero_discount(self):
        response = self._create_internal(discount_percentage=0)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("0.00"))
        self.assertEqual(order.discount_amount, Decimal("0.00"))
        self.assertEqual(order.total, Decimal("100.00"))

    def test_staff_create_accepts_fractional_discount(self):
        response = self._create_internal(discount_percentage=12.5)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("12.50"))
        self.assertEqual(order.discount_amount, Decimal("12.50"))
        self.assertEqual(order.total, Decimal("87.50"))

    def test_staff_create_accepts_full_discount(self):
        response = self._create_internal(discount_percentage=100)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("100.00"))
        self.assertEqual(order.total, Decimal("0.00"))

    def test_staff_create_accepts_numeric_string_discount(self):
        response = self._create_internal(discount_percentage="12.5")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("12.50"))
        self.assertEqual(order.total, Decimal("87.50"))

    def test_staff_create_keeps_coupon_and_discount_math(self):
        Coupon.objects.create(
            restaurant=self.restaurant,
            code="TENOFF",
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal("10.00"),
            min_purchase=Decimal("0.00"),
            is_active=True,
            valid_until=timezone.now() + timezone.timedelta(days=1),
        )

        response = self._create_internal(
            discount_percentage=12.5, coupon_code="TENOFF"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("12.50"))
        # 12.5% of 100 = 12.50 plus the 10.00 coupon => 22.50 discount, 77.50 total.
        self.assertEqual(order.discount_amount, Decimal("22.50"))
        self.assertEqual(order.total, Decimal("77.50"))
        self.assertIsNotNone(order.coupon)
        self.assertIsNotNone(order.coupon.used_at)

    # ------------------------------------------------- rejected on creation

    def test_staff_create_rejects_discount_outside_policy(self):
        invalid_values = [
            -1,
            "-0.01",
            100.01,
            "150",
            "abc",
            "",
            12.345,
            "12.500",
            True,
            False,
            None,
            "NaN",
            "Infinity",
            "-Infinity",
            [1],
            {"value": 1},
        ]
        for raw in invalid_values:
            with self.subTest(raw=raw):
                response = self._create_internal(discount_percentage=raw)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                    msg=f"{raw!r} -> {response.data}",
                )
                self.assertIn("discount_percentage", response.data)
                self._assert_nothing_created()

    def test_shared_validator_rejects_non_finite_floats(self):
        # Raw float NaN/Infinity cannot be serialised by the strict-JSON API client,
        # so they are asserted on the shared validator directly; their string forms
        # ("NaN", "Infinity", "-Infinity") are covered by the endpoint test above.
        for raw in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_discount_percentage(raw)

    def test_serializer_patch_rejects_discount_outside_policy(self):
        created = self._create_internal(discount_percentage=0)
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        order_id = created.data["id"]

        response = self.client.patch(
            f"/api/orders/{order_id}/",
            {"discount_percentage": 150},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("discount_percentage", response.data)
        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.discount_percentage, Decimal("0.00"))

    # ------------------------------------------- public orders stay isolated

    def test_public_order_discount_is_forced_to_zero(self):
        for raw in (50, 150, -5, True):
            with self.subTest(raw=raw):
                response = self._create_public(discount_percentage=raw)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_201_CREATED,
                    msg=f"{raw!r} -> {response.data}",
                )
                order = Order.objects.get(pk=response.data["id"])
                self.assertEqual(order.discount_percentage, Decimal("0.00"))
                self.assertEqual(order.discount_amount, Decimal("0.00"))
                self.assertEqual(order.total, Decimal("100.00"))

    def test_public_order_still_creates_valid_orders(self):
        response = self._create_public()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, msg=response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.discount_percentage, Decimal("0.00"))

    # ------------------------------------------------------ single policy

    def test_views_reuse_the_shared_validator(self):
        from orders import views as order_views

        # No second, conflicting implementation: the edit endpoint imports the
        # exact same function object the serializer uses.
        self.assertIs(order_views.parse_discount_percentage, parse_discount_percentage)

    def test_shared_validator_accepts_and_rejects_the_policy(self):
        for raw, expected in [
            (0, "0.00"),
            (12.5, "12.50"),
            ("12.5", "12.50"),
            (100, "100.00"),
            (99.99, "99.99"),
        ]:
            with self.subTest(raw=raw):
                self.assertEqual(
                    parse_discount_percentage(raw), Decimal(expected)
                )
        for raw in (-1, 100.01, 12.345, "12.500", True, None, "abc", "NaN", "Infinity"):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_discount_percentage(raw)
