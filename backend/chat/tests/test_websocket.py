import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from chat.models import Message
from config.asgi import application

# Consumers touch the DB from a worker thread, so tests need real transactions.
pytestmark = pytest.mark.django_db(transaction=True)

ORIGIN = [(b"origin", b"http://localhost")]


def connect(slug, token=None):
    path = f"/ws/rooms/{slug}/"
    if token:
        path += f"?token={token}"
    return WebsocketCommunicator(application, path, headers=ORIGIN)


async def test_rejects_missing_token(room):
    ws = connect("general")
    connected, code = await ws.connect()
    assert not connected
    assert code == 4401


async def test_rejects_invalid_token(room):
    ws = connect("general", token="not-a-jwt")
    connected, code = await ws.connect()
    assert not connected
    assert code == 4401


async def test_rejects_unknown_room(user, token_for):
    ws = connect("does-not-exist", token_for(user))
    connected, code = await ws.connect()
    assert not connected
    assert code == 4404


async def test_message_is_saved_and_broadcast(room, user, other_user, token_for):
    alice = connect("general", token_for(user))
    bob = connect("general", token_for(other_user))
    assert (await alice.connect())[0]
    assert (await alice.receive_json_from())["action"] == "joined"  # alice's own join
    assert (await bob.connect())[0]
    assert (await alice.receive_json_from()) == {"type": "presence", "user": "bob", "action": "joined"}
    await bob.receive_json_from()  # bob's own join

    await alice.send_json_to({"type": "message", "content": "  hello bob  "})

    for ws in (alice, bob):
        event = await ws.receive_json_from()
        assert event["type"] == "message"
        assert event["message"]["author"] == "alice"
        assert event["message"]["content"] == "hello bob"

    saved = await database_sync_to_async(list)(Message.objects.values_list("content", flat=True))
    assert saved == ["hello bob"]

    await bob.disconnect()
    assert (await alice.receive_json_from()) == {"type": "presence", "user": "bob", "action": "left"}
    await alice.disconnect()


async def test_typing_is_not_echoed_to_sender(room, user, other_user, token_for):
    alice = connect("general", token_for(user))
    bob = connect("general", token_for(other_user))
    await alice.connect()
    await alice.receive_json_from()
    await bob.connect()
    await alice.receive_json_from()
    await bob.receive_json_from()

    await alice.send_json_to({"type": "typing", "is_typing": True})

    assert (await bob.receive_json_from()) == {"type": "typing", "user": "alice", "is_typing": True}
    assert await alice.receive_nothing(timeout=0.2)

    await alice.disconnect()
    await bob.disconnect()


@pytest.mark.parametrize(
    "payload, detail",
    [
        ({"type": "message", "content": "   "}, "Message cannot be empty."),
        ({"type": "message", "content": "x" * 2001}, "Message is longer than 2000 characters."),
        ({"type": "dance"}, "Unknown event type."),
    ],
)
async def test_invalid_events_return_errors(room, user, token_for, payload, detail):
    ws = connect("general", token_for(user))
    await ws.connect()
    await ws.receive_json_from()

    await ws.send_json_to(payload)
    assert (await ws.receive_json_from()) == {"type": "error", "detail": detail}
    assert await database_sync_to_async(Message.objects.count)() == 0

    await ws.disconnect()


async def test_connection_survives_idle_period(room, user, other_user, token_for):
    """Regression: redis-py 8 defaults to a 5s socket timeout, the same length as
    channels_redis's blocking read, which dropped idle connections every few seconds.
    Most meaningful when run with REDIS_URL set (as CI does)."""
    alice = connect("general", token_for(user))
    bob = connect("general", token_for(other_user))
    await alice.connect()
    await alice.receive_json_from()
    await bob.connect()
    await alice.receive_json_from()
    await bob.receive_json_from()

    # Stay idle for longer than the 5s blocking read.
    assert await bob.receive_nothing(timeout=7, interval=0.5)

    await alice.send_json_to({"type": "message", "content": "still here?"})
    event = await bob.receive_json_from(timeout=5)
    assert event["message"]["content"] == "still here?"

    await alice.disconnect()
    await bob.disconnect()
