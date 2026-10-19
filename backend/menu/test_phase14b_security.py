from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from tenants.models import Restaurant
from menu.models import Category, MenuItem

User = get_user_model()


class MenuSecurityAndTenantIsolationTests(TestCase):
    """
    Phase 14B tests for Category and MenuItem tenant isolation and permission restrictions.
    """

    def setUp(self):
        self.client = APIClient()

        # Restaurant A
        self.restaurant_a = Restaurant.objects.create(
            name="Restaurant A",
            slug="restaurant-a",
            is_active=True
        )
        self.user_a = User.objects.create_user(
            username="owner_a",
            password="password123",
            role="owner",
            restaurant=self.restaurant_a,
            is_staff=True
        )
        self.cat_a = Category.objects.create(
            name="Drinks A",
            restaurant=self.restaurant_a,
            is_active=True
        )
        self.item_a = MenuItem.objects.create(
            category=self.cat_a,
            name="Coffee A",
            price=Decimal("25.00"),
            is_available=True
        )

        # Restaurant B
        self.restaurant_b = Restaurant.objects.create(
            name="Restaurant B",
            slug="restaurant-b",
            is_active=True
        )
        self.user_b = User.objects.create_user(
            username="owner_b",
            password="password123",
            role="owner",
            restaurant=self.restaurant_b,
            is_staff=True
        )
        self.cat_b = Category.objects.create(
            name="Drinks B",
            restaurant=self.restaurant_b,
            is_active=True
        )

        # Superuser
        self.superuser = User.objects.create_superuser(
            username="sysadmin",
            password="adminpassword123",
            email="admin@example.com"
        )

    def test_01_anonymous_cannot_list_categories_via_staff_endpoint(self):
        """Anonymous callers hitting /api/menu/categories/ are rejected with 401."""
        response = self.client.get("/api/menu/categories/", secure=True)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_02_staff_only_sees_own_restaurant_categories(self):
        """Staff of Restaurant A only sees Category A and never Category B."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/menu/categories/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        category_ids = [c["id"] for c in response.data]
        self.assertIn(self.cat_a.id, category_ids)
        self.assertNotIn(self.cat_b.id, category_ids)

    def test_03_staff_cannot_create_item_in_another_restaurant_category(self):
        """Staff of Restaurant A cannot create an item using Restaurant B's category."""
        self.client.force_authenticate(user=self.user_a)
        payload = {
            "name": "Intruder Item",
            "category": self.cat_b.id,  # Restaurant B category!
            "price": "50.00"
        }
        response = self.client.post("/api/menu/items/", payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_04_staff_cannot_update_item_to_another_restaurant_category(self):
        """Staff of Restaurant A cannot reassign an item to Restaurant B's category."""
        self.client.force_authenticate(user=self.user_a)
        payload = {
            "category": self.cat_b.id
        }
        response = self.client.patch(f"/api/menu/items/{self.item_a.id}/", payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_05_staff_cannot_delete_another_restaurant_category(self):
        """Staff of Restaurant A cannot delete Category B."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.delete(f"/api/menu/categories/{self.cat_b.id}/", secure=True)
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        self.cat_b.refresh_from_db()
        self.assertFalse(self.cat_b.is_deleted)

    def test_06_public_slug_menu_access_still_works(self):
        """Public customers can view menu scoped by restaurant slug."""
        response = self.client.get(f"/api/public/{self.restaurant_a.slug}/menu/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cat_names = [c["name"] for c in response.data]
        self.assertIn(self.cat_a.name, cat_names)
        self.assertNotIn(self.cat_b.name, cat_names)

    def test_07_superuser_has_global_access(self):
        """Superusers can view all categories."""
        self.client.force_authenticate(user=self.superuser)
        response = self.client.get("/api/menu/categories/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category_ids = [c["id"] for c in response.data]
        self.assertIn(self.cat_a.id, category_ids)
        self.assertIn(self.cat_b.id, category_ids)
