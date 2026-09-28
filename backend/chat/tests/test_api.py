import pytest

from chat.models import Message, Room
from conftest import PASSWORD

pytestmark = pytest.mark.django_db


class TestAuth:
    def test_register_and_login(self, api):
        res = api.post("/api/auth/register/", {"username": "carol", "password": PASSWORD})
        assert res.status_code == 201
        assert "password" not in res.data

        res = api.post("/api/auth/login/", {"username": "carol", "password": PASSWORD})
        assert res.status_code == 200
        assert {"access", "refresh"} <= res.data.keys()

    def test_register_rejects_weak_password(self, api):
        res = api.post("/api/auth/register/", {"username": "carol", "password": "123"})
        assert res.status_code == 400

    def test_me_requires_auth(self, api):
        assert api.get("/api/auth/me/").status_code == 401

    def test_me_returns_current_user(self, auth_api, user):
        res = auth_api.get("/api/auth/me/")
        assert res.data == {"id": user.id, "username": "alice"}


class TestRooms:
    def test_list_requires_auth(self, api, room):
        assert api.get("/api/rooms/").status_code == 401

    def test_list_rooms(self, auth_api, room):
        res = auth_api.get("/api/rooms/")
        assert res.status_code == 200
        assert [r["slug"] for r in res.data] == ["general"]

    def test_create_room_sets_slug_and_owner(self, auth_api):
        res = auth_api.post("/api/rooms/", {"name": "Python Devs", "description": "All things py"})
        assert res.status_code == 201
        assert res.data["slug"] == "python-devs"
        assert res.data["created_by"] == "alice"

    def test_create_room_rejects_duplicate_slug(self, auth_api, room):
        res = auth_api.post("/api/rooms/", {"name": "general!"})
        assert res.status_code == 400

    def test_create_room_rejects_symbol_only_name(self, auth_api):
        res = auth_api.post("/api/rooms/", {"name": "!!!"})
        assert res.status_code == 400


class TestMessageHistory:
    def test_returns_messages_oldest_first(self, auth_api, room, user):
        for i in range(3):
            Message.objects.create(room=room, author=user, content=f"msg {i}")
        res = auth_api.get("/api/rooms/general/messages/")
        assert [m["content"] for m in res.data["results"]] == ["msg 0", "msg 1", "msg 2"]
        assert res.data["has_more"] is False

    def test_paginates_with_before_cursor(self, auth_api, room, user):
        msgs = [Message.objects.create(room=room, author=user, content=f"m{i}") for i in range(60)]

        first = auth_api.get("/api/rooms/general/messages/").data
        assert len(first["results"]) == 50
        assert first["results"][-1]["content"] == "m59"
        assert first["has_more"] is True

        oldest_id = first["results"][0]["id"]
        second = auth_api.get(f"/api/rooms/general/messages/?before={oldest_id}").data
        assert [m["content"] for m in second["results"]] == [f"m{i}" for i in range(10)]
        assert second["has_more"] is False
        assert msgs[0].id == second["results"][0]["id"]

    def test_unknown_room_404(self, auth_api):
        assert auth_api.get("/api/rooms/nope/messages/").status_code == 404

    def test_bad_cursor_400(self, auth_api, room):
        assert auth_api.get("/api/rooms/general/messages/?before=abc").status_code == 400


def test_room_slug_generated_on_save(user):
    assert Room.objects.create(name="Late Night Coders").slug == "late-night-coders"
