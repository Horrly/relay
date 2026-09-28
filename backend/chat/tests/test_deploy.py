import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from chat.models import Message, Room

pytestmark = pytest.mark.django_db


def test_health_check_is_public(client):
    res = client.get("/api/health/")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


class TestSpaFallback:
    def test_serves_index_for_client_routes(self, client, settings, tmp_path):
        (tmp_path / "index.html").write_text("<div id='root'></div>")
        settings.FRONTEND_DIST = tmp_path

        for path in ["/", "/login", "/rooms/general"]:
            res = client.get(path)
            assert res.status_code == 200
            assert b"id='root'" in b"".join(res.streaming_content)
            assert res["Cache-Control"] == "no-cache"

    def test_api_paths_are_not_swallowed(self, client, settings, tmp_path):
        (tmp_path / "index.html").write_text("<div id='root'></div>")
        settings.FRONTEND_DIST = tmp_path
        assert client.get("/api/rooms/").status_code == 401  # DRF, not the SPA
        assert client.get("/api/nope/").status_code == 404

    def test_helpful_404_when_frontend_not_built(self, client, settings, tmp_path):
        settings.FRONTEND_DIST = tmp_path
        res = client.get("/")
        assert res.status_code == 404
        assert b"Frontend not built" in res.content


class TestSeedDemo:
    def test_creates_demo_user_and_rooms(self, monkeypatch):
        monkeypatch.setenv("DEMO_PASSWORD", "Demo-pass-123")
        call_command("seed_demo")

        demo = get_user_model().objects.get(username="demo")
        assert demo.check_password("Demo-pass-123")
        assert set(Room.objects.values_list("slug", flat=True)) == {"general", "introductions", "help"}
        assert Message.objects.count() == 3

    def test_is_idempotent_and_resets_password(self, monkeypatch):
        call_command("seed_demo")
        demo = get_user_model().objects.get(username="demo")
        demo.set_password("someone-changed-it")
        demo.save()

        call_command("seed_demo")

        demo.refresh_from_db()
        assert demo.check_password("Demo-pass-123")
        assert Room.objects.count() == 3
        assert Message.objects.count() == 3
