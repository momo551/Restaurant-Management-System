from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from tenants.models import Restaurant
from menu.models import Category, MenuItem
from orders.models import Order
from loyalty.models import Coupon

User = get_user_model()


class PublicOrderSecurityTests(TestCase):
    """
    Phase 14B regression tests verifying that public order creation cannot manipulate
    order status, discount percentage, discount amount, unit prices, or driver internals.
    """

    def setUp(self):
        self.client = APIClient()

        # Create two restaurants
        self.restaurant_a = Restaurant.objects.create(
            name="Restaurant Alpha",
            slug="restaurant-alpha",
            is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Restaurant Beta",
            slug="restaurant-beta",
            is_active=True
        )

        # Create Owner for Restaurant A (role='owner' grants module access)
        self.staff_a = User.objects.create_user(
            username="owner_a",
            password="securepass123",
            role="owner",
            restaurant=self.restaurant_a,
            is_staff=True
        )

        # Create Category and Menu Items for Restaurant A
        self.cat_a = Category.objects.create(
            name="Burgers",
            restaurant=self.restaurant_a,
            is_active=True
        )
        self.item_a1 = MenuItem.objects.create(
            category=self.cat_a,
            name="Classic Cheeseburger",
            price=Decimal("100.00"),
            is_available=True
        )
        self.item_a2 = MenuItem.objects.create(
            category=self.cat_a,
            name="Fries",
            price=Decimal("30.00"),
            is_available=True
        )

        # Create a valid active coupon for Restaurant A
        self.coupon_a = Coupon.objects.create(
            restaurant=self.restaurant_a,
            code="SAVE20",
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal("20.00"),
            min_purchase=Decimal("50.00"),
            is_active=True,
            valid_until=timezone.now() + timezone.timedelta(days=7)
        )

    def test_01_public_order_cannot_set_delivered_status(self):
        """A public customer cannot create an order already marked 'delivered'."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "John Doe",
            "customer_phone": "01011112222",
            "order_type": "takeaway",
            "status": "delivered",  # Attacker attempt
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order_id = response.data["id"]
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertNotEqual(order.status, Order.Status.DELIVERED)

    def test_02_public_order_cannot_set_paid_status(self):
        """A public customer cannot create an order already marked 'paid'."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "Jane Doe",
            "customer_phone": "01033334444",
            "order_type": "delivery",
            "delivery_address": "123 Nile St",
            "status": "paid",  # Attacker attempt
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertNotEqual(order.status, Order.Status.PAID)

    def test_03_public_order_cannot_set_arbitrary_discount_percentage(self):
        """A public customer cannot obtain an arbitrary 100% discount."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "Attacker",
            "customer_phone": "01055556666",
            "order_type": "takeaway",
            "discount_percentage": 100,  # Attacker attempt: 100% off
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.discount_percentage, Decimal("0.00"))
        self.assertEqual(order.total, Decimal("100.00"))

    def test_04_public_order_cannot_override_discount_amount(self):
        """Submitted discount amounts cannot override server-calculated amounts."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "Attacker",
            "customer_phone": "01055556666",
            "order_type": "takeaway",
            "discount_amount": 99.99,  # Attacker attempt
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.discount_amount, Decimal("0.00"))
        self.assertEqual(order.total, Decimal("100.00"))

    def test_05_public_order_cannot_dictate_unit_price(self):
        """Public order items must always use server-side menu prices, not client-supplied prices."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "Attacker",
            "customer_phone": "01077778888",
            "order_type": "takeaway",
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 2, "unit_price": "0.01"}  # Attacker attempt
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        item = order.items.first()
        self.assertEqual(item.unit_price, Decimal("100.00"))
        self.assertEqual(order.total, Decimal("200.00"))

    def test_06_valid_public_order_with_valid_coupon_succeeds(self):
        """A valid public order with a supported, valid coupon applies server-side coupon discount."""
        url = f"/api/public/{self.restaurant_a.slug}/orders/"
        payload = {
            "customer_name": "Loyal Customer",
            "customer_phone": "01099990000",
            "order_type": "takeaway",
            "coupon_code": "SAVE20",
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}  # Subtotal = 100.00
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertEqual(order.discount_amount, Decimal("20.00"))
        self.assertEqual(order.total, Decimal("80.00"))
        self.assertIsNotNone(order.coupon)
        self.assertEqual(order.coupon.code, "SAVE20")

    def test_07_authorized_staff_order_operations_continue_working(self):
        """Staff orders created via authenticated POS endpoints function normally."""
        self.client.force_authenticate(user=self.staff_a)
        url = "/api/orders/"
        payload = {
            "order_type": "takeaway",
            "customer_name": "Walk-in Guest",
            "customer_phone": "01012345678",
            "discount_percentage": Decimal("10.00"),  # Staff authorized discount
            "items": [
                {"menu_item": self.item_a1.id, "quantity": 1}
            ]
        }
        response = self.client.post(url, payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order = Order.objects.get(id=response.data["id"])
        self.assertEqual(order.restaurant, self.restaurant_a)
        self.assertEqual(order.discount_percentage, Decimal("10.00"))
        self.assertEqual(order.discount_amount, Decimal("10.00"))
        self.assertEqual(order.total, Decimal("90.00"))
