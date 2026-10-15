from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from rest_framework import exceptions

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom authentication class that reads tokens from HttpOnly cookies.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        
        if header is None:
            # Try to get the token from cookies
            raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE']) or None
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
