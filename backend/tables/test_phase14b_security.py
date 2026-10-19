from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from tenants.models import Restaurant
from tables.models import Table, TableSession, QRCode

User = get_user_model()


class TableSecurityAndSessionIsolationTests(TestCase):
    """
    Phase 14B tests for Table and TableSession security and CRUD restrictions.
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
        self.table_a = Table.objects.create(
            restaurant=self.restaurant_a,
            number=1,
            capacity=4,
            is_active=True
        )
        # QRCode is created automatically by table post_save signal
        self.qr_a = QRCode.objects.get(table=self.table_a)
        self.session_a = TableSession.objects.create(
            table=self.table_a,
            is_active=True
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
        self.table_b = Table.objects.create(
            restaurant=self.restaurant_b,
            number=2,
            capacity=2,
            is_active=True
        )
        self.session_b = TableSession.objects.create(
            table=self.table_b,
            is_active=True
        )

    def test_01_anonymous_cannot_list_tables(self):
        """Anonymous callers to /api/tables/ receive 401."""
        response = self.client.get("/api/tables/", secure=True)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_02_anonymous_cannot_list_table_sessions(self):
        """Anonymous callers to /api/tables/sessions/ receive 401."""
        response = self.client.get("/api/tables/sessions/", secure=True)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_03_anonymous_cannot_delete_table_session(self):
        """Anonymous callers cannot delete a table session."""
        response = self.client.delete(f"/api/tables/sessions/{self.session_a.id}/", secure=True)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.assertTrue(TableSession.objects.filter(id=self.session_a.id).exists())

    def test_04_anonymous_can_create_session_with_valid_slug_and_table(self):
        """Customers scanning QR can create a session via create_session action."""
        payload = {
            "table_id": self.table_a.id,
            "restaurant_slug": self.restaurant_a.slug
        }
        response = self.client.post("/api/tables/sessions/create_session/", payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["table"], self.table_a.id)

    def test_05_staff_only_sees_own_restaurant_tables(self):
        """Staff of Restaurant A only sees Table A, never Table B."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/tables/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        table_ids = [t["id"] for t in response.data]
        self.assertIn(self.table_a.id, table_ids)
        self.assertNotIn(self.table_b.id, table_ids)

    def test_06_staff_cannot_modify_other_restaurant_table(self):
        """Staff A cannot update Table B."""
        self.client.force_authenticate(user=self.user_a)
        payload = {"status": "occupied"}
        response = self.client.post(f"/api/tables/{self.table_b.id}/update_status/", payload, format="json", secure=True)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_07_public_from_qr_still_resolves_table(self):
        """Public QR resolver works cleanly without staff authentication."""
        response = self.client.get(f"/api/tables/from-qr/{self.qr_a.code}/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.table_a.id)
        self.assertEqual(response.data["restaurant_slug"], self.restaurant_a.slug)
