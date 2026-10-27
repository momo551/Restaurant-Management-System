"""
Regression tests for ``discount_percentage`` handling on
``PATCH /api/orders/<pk>/edit/``.

Policy: the discount is a percentage with at most two decimals in the 0..100 range.
That matches the POS input (frontend/src/pages/OrderTaking.jsx: min=0, max=100,
step=0.01) and the model column (max_digits=5, decimal_places=2).

An invalid value must be answered with 400 before anything is written: the view
runs inside ``@transaction.atomic`` and a returned error Response does not roll
back previous writes, so validation has to happen first.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from rest_framework import status
from rest_framework.test import APIClient

from billing.models import Invoice
from menu.models import Category, MenuItem
from orders.models import Order, OrderAuditLog, OrderItem
from orders.views import parse_discount_percentage
from tenants.models import Restaurant

User = get_user_model()


class OrderEditDiscountValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.restaurant = Restaurant.objects.create(
            name="Discount Rest", slug="discount-rest", is_active=True
        )
        self.category = Category.objects.create(
            name="Cat", restaurant=self.restaurant
        )
        self.item = MenuItem.objects.create(
            category=self.category, name="Item", price=Decimal("100.00")
        )
        self.item_extra = MenuItem.objects.create(
            category=self.category, name="Extra", price=Decimal("50.00")
        )
        self.owner = User.objects.create_user(
            username="discount_owner",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant,
        )

        self.order = Order.objects.create(
            restaurant=self.restaurant,
            order_number="ORD-DISC-001",
            daily_id=1,
            order_type=Order.OrderType.TAKEAWAY,
            status=Order.Status.PENDING,
            notes="original notes",
            discount_percentage=Decimal("0.00"),
            subtotal=Decimal("100.00"),
            total=Decimal("100.00"),
        )
        self.item_line = OrderItem.objects.create(
            order=self.order,
            menu_item=self.item,
            quantity=1,
            unit_price=Decimal("100.00"),
        )

        self.url = f"/api/orders/{self.order.id}/edit/"
        self.client.force_authenticate(user=self.owner)

    # -------------------------------------------------------------- helpers

    def _edit(self, payload):
        return self.client.patch(self.url, payload, format="json")

    def _order(self):
        return Order.objects.get(pk=self.order.pk)

    def _assert_order_untouched(self):
        order = self._order()
        self.assertEqual(order.notes, "original notes")
        self.assertEqual(order.discount_percentage, Decimal("0.00"))
        self.assertEqual(order.discount_amount, Decimal("0.00"))
        self.assertEqual(order.total, Decimal("100.00"))
        self.assertFalse(order.is_edited)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.get().quantity, 1)
        self.assertFalse(OrderAuditLog.objects.filter(order=order).exists())

    # -------------------------------------------------- accepted values

    def test_fractional_discount_is_accepted_and_stored_as_decimal(self):
        response = self._edit({"discount_percentage": 12.5})

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = self._order()
        self.assertEqual(order.discount_percentage, Decimal("12.50"))
        self.assertEqual(order.discount_amount, Decimal("12.50"))
        self.assertEqual(order.total, Decimal("87.50"))
        self.assertEqual(OrderAuditLog.objects.filter(order=order).count(), 1)

    def test_zero_discount_is_accepted(self):
        response = self._edit({"discount_percentage": 0})

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = self._order()
        self.assertEqual(order.discount_percentage, Decimal("0.00"))
        self.assertEqual(order.total, Decimal("100.00"))

    def test_hundred_percent_discount_is_accepted(self):
        response = self._edit({"discount_percentage": 100})

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = self._order()
        self.assertEqual(order.discount_percentage, Decimal("100.00"))
        self.assertEqual(order.total, Decimal("0.00"))

    def test_numeric_string_discount_is_accepted(self):
        response = self._edit({"discount_percentage": "12.5"})

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = self._order()
        self.assertEqual(order.discount_percentage, Decimal("12.50"))
        self.assertEqual(order.total, Decimal("87.50"))

    # ------------------------------------------------ rejected values (400)

    def test_out_of_range_and_malformed_discounts_are_rejected(self):
        invalid_values = [
            -1,
            "-0.01",
            100.01,
            "150",
            "abc",
            "",
            "12.345",
            12.345,
            [1],
            {"value": 1},
            True,
            False,
            None,
        ]
        for raw in invalid_values:
            with self.subTest(raw=raw):
                response = self._edit({"discount_percentage": raw})
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                    msg=f"{raw!r} -> {response.data}",
                )
                self.assertIn("error", response.data)
                self._assert_order_untouched()

    def test_non_finite_discount_values_are_rejected(self):
        for raw in ("NaN", "nan", "Infinity", "-Infinity", "inf", "sNaN"):
            with self.subTest(raw=raw):
                response = self._edit({"discount_percentage": raw})
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                    msg=f"{raw!r} -> {response.data}",
                )
                self.assertIn("error", response.data)
                self._assert_order_untouched()

    def test_validator_itself_rejects_non_finite_and_invalid_types(self):
        for raw in (float("nan"), float("inf"), float("-inf")):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_discount_percentage(raw)
        for raw in (True, False, None, [], {}, "abc", "", -1, 100.01, 12.345):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    parse_discount_percentage(raw)

    def test_validator_accepts_and_quantizes_valid_values(self):
        self.assertEqual(parse_discount_percentage(12.5), Decimal("12.50"))
        self.assertEqual(parse_discount_percentage("0.1"), Decimal("0.10"))
        self.assertEqual(parse_discount_percentage(0), Decimal("0.00"))
        self.assertEqual(parse_discount_percentage(100), Decimal("100.00"))
        self.assertEqual(
            parse_discount_percentage(Decimal("99.99")), Decimal("99.99")
        )

    # ------------------------------------------- no partial writes on error

    def test_invalid_discount_with_notes_and_items_changes_nothing(self):
        invoice = Invoice.objects.create(order=self.order, subtotal=Decimal("100.00"))

        response = self._edit(
            {
                "discount_percentage": "not-a-number",
                "notes": "tampered notes",
                "items": [
                    {"id": self.item_line.id, "quantity": 5},
                    {"menu_item": self.item_extra.id, "quantity": 2},
                ],
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self._assert_order_untouched()
        self.assertEqual(OrderItem.objects.filter(order=self.order).count(), 1)

        invoice.refresh_from_db()
        self.assertEqual(invoice.subtotal, Decimal("100.00"))
        self.assertEqual(invoice.tax_amount, Decimal("14.00"))
        self.assertEqual(invoice.total_amount, Decimal("114.00"))

    def test_failed_item_edit_rolls_back_previous_item_changes(self):
        extra_line = OrderItem.objects.create(
            order=self.order,
            menu_item=self.item_extra,
            quantity=1,
            unit_price=Decimal("50.00"),
        )

        response = self._edit(
            {
                "items": [
                    {"id": self.item_line.id, "quantity": 4},
                    {"id": extra_line.id, "quantity": 0},
                ]
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.item_line.refresh_from_db()
        self.assertEqual(self.item_line.quantity, 1)
        extra_line.refresh_from_db()
        self.assertEqual(extra_line.quantity, 1)
        self.assertFalse(OrderAuditLog.objects.filter(order=self.order).exists())

    # ------------------------------------------------- successful edit path

    def test_successful_edit_updates_invoice_and_audit_log(self):
        invoice = Invoice.objects.create(order=self.order, subtotal=Decimal("100.00"))

        # Edit the discount together with an item so both the order totals and the
        # invoice sync (which mirrors the items subtotal) are exercised.
        response = self._edit(
            {
                "discount_percentage": 10,
                "notes": "edited by owner",
                "items": [{"id": self.item_line.id, "quantity": 2}],
            }
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=response.data)
        order = self._order()
        self.assertEqual(order.discount_percentage, Decimal("10.00"))
        self.assertEqual(order.subtotal, Decimal("200.00"))
        self.assertEqual(order.discount_amount, Decimal("20.00"))
        self.assertEqual(order.total, Decimal("180.00"))
        self.assertEqual(order.notes, "edited by owner")
        self.assertTrue(order.is_edited)

        invoice.refresh_from_db()
        self.assertEqual(invoice.subtotal, Decimal("200.00"))
        self.assertEqual(invoice.tax_amount, Decimal("28.00"))
        self.assertEqual(invoice.total_amount, Decimal("228.00"))

        log = OrderAuditLog.objects.get(order=order)
        self.assertEqual(log.action, OrderAuditLog.ActionType.EDIT)
        self.assertEqual(log.user, self.owner)
        self.assertEqual(
            Decimal(str(log.data_before["discount_percentage"])), Decimal("0.00")
        )
        self.assertEqual(
            Decimal(str(log.data_after["discount_percentage"])), Decimal("10.00")
        )
