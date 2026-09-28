"""Authenticate WebSocket connections with a JWT passed as `?token=<access token>`.

Browsers can't set an Authorization header on a WebSocket, so the access
token travels in the query string. It's short-lived (30 min) and only ever
sent over the same origin the app is served from.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def get_user_from_token(raw_token):
    try:
        token = AccessToken(raw_token)
        return get_user_model().objects.get(id=token["user_id"])
    except (InvalidToken, TokenError, KeyError, get_user_model().DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
