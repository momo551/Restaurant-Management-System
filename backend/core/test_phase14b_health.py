from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status


class HealthCheckAndSettingsGuardTests(TestCase):
    """
    Phase 14B tests for health check endpoint and production database guard.
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_health_check_endpoint_returns_ok_unauthenticated(self):
        """Health check returns 200 OK without requiring authentication."""
        response = self.client.get("/health/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})
