from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tenants.models import Restaurant

User = get_user_model()


class LogoutViewSecurityTests(TestCase):
    """F5: logout must revoke only the caller's refresh token and stay idempotent."""

    def setUp(self):
        self.restaurant = Restaurant.objects.create(
            name="Logout Rest", slug="logout-rest", is_active=True
        )
        self.user = User.objects.create_user(
            username="logout_owner",
            password="x-pass-12345",
            role="owner",
            restaurant=self.restaurant,
        )
        self.other_user = User.objects.create_user(
            username="logout_other",
            password="x-pass-12345",
            role="cashier",
            restaurant=self.restaurant,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    # ------------------------------------------------------------- helpers

    def _refresh_for(self, user):
        return str(RefreshToken.for_user(user))

    def _logout(self, payload):
        return self.client.post("/api/logout/", payload, format="json")

    def _refresh_status(self, token):
        return APIClient().post(
            "/api/token/refresh/", {"refresh": token}, format="json"
        ).status_code

    def _assert_no_internal_details(self, response):
        body = str(response.data).lower()
        for marker in ("blacklist", "token is", "expired", "jwt", "traceback"):
            self.assertNotIn(marker, body)

    # --------------------------------------------------------------- tests

    def test_logout_blacklists_own_refresh_token(self):
        token = self._refresh_for(self.user)

        response = self._logout({"refresh": token})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._refresh_status(token), status.HTTP_401_UNAUTHORIZED)

    def test_logout_cannot_blacklist_another_users_refresh_token(self):
        other_token = self._refresh_for(self.other_user)

        response = self._logout({"refresh": other_token})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self._assert_no_internal_details(response)
        # The victim's session must remain usable.
        self.assertEqual(self._refresh_status(other_token), status.HTTP_200_OK)

    def test_logout_without_refresh_token_is_idempotent(self):
        response = self._logout({})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"message": "Logged out"})

    def test_logout_with_garbage_token_is_idempotent_and_hides_internals(self):
        response = self._logout({"refresh": "this-is-not-a-jwt"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"message": "Logged out"})
        self._assert_no_internal_details(response)

    def test_logout_with_already_blacklisted_token_is_idempotent(self):
        token = self._refresh_for(self.user)
        first = self._logout({"refresh": token})
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self._logout({"refresh": token})

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data, {"message": "Logged out"})
        self._assert_no_internal_details(second)

    def test_logout_requires_authentication(self):
        anonymous = APIClient()

        response = anonymous.post(
            "/api/logout/", {"refresh": self._refresh_for(self.user)}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_with_non_string_refresh_payload_does_not_crash(self):
        for payload in ({"refresh": ["a"]}, {"refresh": 123}, {"refresh": {"x": 1}}):
            with self.subTest(payload=payload):
                response = self._logout(payload)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, {"message": "Logged out"})

    def test_logout_does_not_leak_internal_error_on_foreign_token(self):
        response = self._logout({"refresh": self._refresh_for(self.other_user)})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            set(response.data.keys()), {"detail"}, "only a generic detail is exposed"
        )

    def test_login_and_refresh_flow_still_works(self):
        login = APIClient().post(
            "/api/token/",
            {"username": "logout_owner", "password": "x-pass-12345"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertIn("access", login.data)
        self.assertIn("refresh", login.data)

        refreshed = APIClient().post(
            "/api/token/refresh/", {"refresh": login.data["refresh"]}, format="json"
        )
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.assertIn("access", refreshed.data)

    def test_refresh_rotation_blacklists_the_previous_refresh_token(self):
        """
        Premise of the frontend logout race fix: with ROTATE_REFRESH_TOKENS +
        BLACKLIST_AFTER_ROTATION, a refresh replaces R1 with R2 and R1 dies. That
        is why a logout retried after a refresh must not keep sending R1.
        """
        login = APIClient().post(
            "/api/token/",
            {"username": "logout_owner", "password": "x-pass-12345"},
            format="json",
        )
        first_refresh = login.data["refresh"]

        rotated = APIClient().post(
            "/api/token/refresh/", {"refresh": first_refresh}, format="json"
        )

        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        self.assertIn("refresh", rotated.data, "rotation should return a new refresh token")
        self.assertNotEqual(rotated.data["refresh"], first_refresh)
        self.assertEqual(self._refresh_status(first_refresh), status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self._refresh_status(rotated.data["refresh"]), status.HTTP_200_OK
        )

    def test_logout_with_user_b_access_and_user_a_refresh_rejects_without_revoking_either(self):
        """
        A request authenticated as user B must not revoke user A's refresh token.
        Both users' refresh tokens must remain usable after the rejected request.
        """
        user_a_refresh = self._refresh_for(self.user)
        user_b_refresh = self._refresh_for(self.other_user)

        client_b = APIClient()
        client_b.force_authenticate(user=self.other_user)

        response = client_b.post(
            "/api/logout/",
            {"refresh": user_a_refresh},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.assertEqual(
            self._refresh_status(user_a_refresh),
            status.HTTP_200_OK,
            "User A's refresh token must remain valid.",
        )
        self.assertEqual(
            self._refresh_status(user_b_refresh),
            status.HTTP_200_OK,
            "User B's refresh token must remain valid.",
        )
