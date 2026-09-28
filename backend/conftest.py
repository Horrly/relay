import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from chat.models import Room

User = get_user_model()
PASSWORD = "Str0ng-pass-123"


@pytest.fixture
def user(db):
    return User.objects.create_user(username="alice", password=PASSWORD)


@pytest.fixture
def other_user(db):
    return User.objects.create_user(username="bob", password=PASSWORD)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def auth_api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def room(user):
    return Room.objects.create(name="General", description="Say hi", created_by=user)


@pytest.fixture
def token_for():
    def make(u):
        return str(AccessToken.for_user(u))

    return make
