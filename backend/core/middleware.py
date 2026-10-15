from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from urllib.parse import parse_qs

User = get_user_model()

@database_sync_to_async
def get_user(user_id):
    try:
        # is_active must be enforced here: the HTTP API rejects deactivated
        # users through SimpleJWT (CHECK_USER_IS_ACTIVE=True), and WebSocket
        # authentication must not be weaker than the REST API.
        return User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return AnonymousUser()

class TokenAuthMiddleware:
    """
    Custom middleware that takes a token from the query string and authenticates the user.
    Usage: ws://localhost:8000/ws/kds/?token=<token>
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # 1. Try to get token from query string (Legacy/Internal)
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]

        # 2. If not in query string, try WebSocket subprotocols (Recommended for privacy)
        if not token:
            subprotocols = scope.get("subprotocols", [])
            # Pattern: ['token', '<JWT_TOKEN>'] or just ['<JWT_TOKEN>']
            if 'token' in subprotocols:
                token_index = subprotocols.index('token') + 1
                if token_index < len(subprotocols):
                    token = subprotocols[token_index]
            elif subprotocols:
                # If only one subprotocol is passed and it looks like a JWT
                token = subprotocols[0]

        # Debug logging (Removed file write to avoid crashes on non-Windows environments)
        # To debug on Railway, use standard python logging:
        # print(f"WS Attempt: Token={token[:20] if token else 'None'}")

        if token:

            try:
                access_token = AccessToken(token)
                user_id = access_token["user_id"]
                scope["user"] = await get_user(user_id)
            except Exception:
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)


def TokenAuthMiddlewareStack(inner):
    return TokenAuthMiddleware(inner)
