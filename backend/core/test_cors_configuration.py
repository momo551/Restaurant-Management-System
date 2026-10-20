from django.test import TestCase, override_settings
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status


class CORSConfigurationTests(TestCase):
    """
    Tests for CORS configuration to ensure:
    - Allowed origins receive proper CORS headers
    - Disallowed origins are rejected
    - Preflight OPTIONS requests are handled correctly
    - Protected endpoints remain protected by authentication
    """

    def setUp(self):
        self.client = APIClient()

    def test_01_cors_middleware_is_installed(self):
        """corsheaders.middleware.CorsMiddleware is in MIDDLEWARE."""
        self.assertIn('corsheaders.middleware.CorsMiddleware', settings.MIDDLEWARE)

    def test_02_cors_middleware_is_before_common_middleware(self):
        """CorsMiddleware is positioned before CommonMiddleware."""
        cors_index = settings.MIDDLEWARE.index('corsheaders.middleware.CorsMiddleware')
        common_index = settings.MIDDLEWARE.index('django.middleware.common.CommonMiddleware')
        self.assertLess(cors_index, common_index,
                       "CorsMiddleware must come before CommonMiddleware")

    def test_03_cors_allow_all_origins_is_false(self):
        """CORS_ALLOW_ALL_ORIGINS is False in production."""
        self.assertFalse(settings.CORS_ALLOW_ALL_ORIGINS,
                        "CORS_ALLOW_ALL_ORIGINS must be False for security")

    def test_04_cors_allowed_origins_includes_vercel_frontend(self):
        """Vercel frontend origin is in CORS_ALLOWED_ORIGINS."""
        self.assertIn('https://restaurant-system-alpha.vercel.app',
                     settings.CORS_ALLOWED_ORIGINS)

    def test_05_cors_allow_credentials_is_true(self):
        """CORS_ALLOW_CREDENTIALS is True for JWT authentication."""
        self.assertTrue(settings.CORS_ALLOW_CREDENTIALS)

    def test_06_csrf_trusted_origins_includes_vercel_frontend(self):
        """Vercel frontend origin is in CSRF_TRUSTED_ORIGINS."""
        self.assertIn('https://restaurant-system-alpha.vercel.app',
                     settings.CSRF_TRUSTED_ORIGINS)

    def test_07_health_check_works_without_cors_origin(self):
        """Health check works without CORS restrictions."""
        response = self.client.get("/health/", secure=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_08_protected_endpoint_requires_auth_without_origin_header(self):
        """Protected endpoint returns 401 without authentication."""
        response = self.client.get("/api/menu/categories/", secure=True)
        self.assertIn(response.status_code,
                     [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    @override_settings(CORS_ALLOWED_ORIGINS=['https://restaurant-system-alpha.vercel.app'])
    def test_09_preflight_options_request_allowed_for_trusted_origin(self):
        """OPTIONS preflight request from trusted origin returns 200."""
        response = self.client.options(
            "/api/menu/categories/",
            HTTP_ORIGIN='https://restaurant-system-alpha.vercel.app',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(CORS_ALLOWED_ORIGINS=['https://restaurant-system-alpha.vercel.app'])
    def test_10_preflight_options_request_from_untrusted_origin_no_cors_headers(self):
        """OPTIONS preflight request from untrusted origin has no CORS headers."""
        response = self.client.options(
            "/api/menu/categories/",
            HTTP_ORIGIN='https://malicious-site.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            secure=True
        )
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)
        response = self.client.options(
            "/api/menu/categories/",
            HTTP_ORIGIN='https://malicious-site.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            secure=True
        )
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)

    @override_settings(CORS_ALLOWED_ORIGINS=['https://restaurant-system-alpha.vercel.app'])
    def test_11_actual_request_from_trusted_origin_gets_cors_headers(self):
        """Actual request from trusted origin includes CORS headers."""
        response = self.client.get(
            "/health/",
            HTTP_ORIGIN='https://restaurant-system-alpha.vercel.app',
            secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Access-Control-Allow-Origin', response.headers)

    @override_settings(CORS_ALLOWED_ORIGINS=['https://restaurant-system-alpha.vercel.app'])
    def test_12_actual_request_from_untrusted_origin_no_cors_headers(self):
        """Actual request from untrusted origin has no CORS headers."""
        response = self.client.get(
            "/health/",
            HTTP_ORIGIN='https://malicious-site.com',
            secure=True
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)
