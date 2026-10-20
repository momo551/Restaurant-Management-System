from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from tenants.models import Restaurant

User = get_user_model()


class AuthenticationFlowTests(TestCase):
    """
    Tests for authentication flow to diagnose 401/403 errors.
    """

    def setUp(self):
        self.client = APIClient()
        # Create a test restaurant
        self.restaurant = Restaurant.objects.create(
            name="Test Restaurant",
            slug="test-restaurant",
            is_active=True
        )
        # Create a test user
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass123",
            email="test@example.com",
            role="owner",
            restaurant=self.restaurant,
            is_staff=True
        )

    def test_01_token_endpoint_allows_anonymous_access(self):
        """Token endpoint should be accessible without authentication."""
        response = self.client.post(
            "/api/token/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
            secure=True
        )
        print(f"Token response status: {response.status_code}")
        print(f"Token response data: {response.data if hasattr(response, 'data') else response.content}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_02_wrong_credentials_return_401(self):
        """Wrong credentials should return 401."""
        response = self.client.post(
            "/api/token/",
            {"username": "testuser", "password": "wrongpass"},
            format="json",
            secure=True
        )
        print(f"Wrong credentials response: {response.status_code}")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_03_protected_endpoint_requires_token(self):
        """Protected endpoints should return 403 without token."""
        response = self.client.get("/api/menu/categories/", secure=True)
        print(f"Protected endpoint without token: {response.status_code}")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_04_protected_endpoint_with_valid_token(self):
        """Protected endpoints should work with valid token."""
        # First, get a token
        token_response = self.client.post(
            "/api/token/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
            secure=True
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access_token = token_response.data['access']

        # Now use the token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get("/api/menu/categories/", secure=True)
        print(f"Protected endpoint with token: {response.status_code}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_05_tables_endpoint_with_valid_token(self):
        """Tables endpoint should work with valid token."""
        # Get a token
        token_response = self.client.post(
            "/api/token/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
            secure=True
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access_token = token_response.data['access']

        # Use the token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get("/api/tables/", secure=True)
        print(f"Tables endpoint with token: {response.status_code}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
