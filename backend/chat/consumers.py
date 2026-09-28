from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings

from .models import Message, Room
from .serializers import MessageSerializer

# Close codes (4000-4999 are reserved for applications).
CLOSE_UNAUTHENTICATED = 4401
CLOSE_ROOM_NOT_FOUND = 4404


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """One connection = one user in one room.

    Client -> server events:
        {"type": "message", "content": "hello"}
        {"type": "typing", "is_typing": true}

    Server -> client events:
        {"type": "message", "message": {...}}
        {"type": "typing", "user": "alice", "is_typing": true}
        {"type": "presence", "user": "alice", "action": "joined" | "left"}
        {"type": "error", "detail": "..."}
    """

    async def connect(self):
        self.user = self.scope["user"]
        self.slug = self.scope["url_route"]["kwargs"]["slug"]
        self.group_name = f"room_{self.slug}"
        self.joined = False

        if not self.user.is_authenticated:
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        self.room = await self.get_room(self.slug)
        if self.room is None:
            await self.close(code=CLOSE_ROOM_NOT_FOUND)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        self.joined = True
        await self.accept()
        await self.broadcast("presence", user=self.user.username, action="joined")

    async def disconnect(self, code):
        if self.joined:
            await self.broadcast("presence", user=self.user.username, action="left")
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event_type = content.get("type")

        if event_type == "message":
            text = str(content.get("content", "")).strip()
            if not text:
                await self.send_json({"type": "error", "detail": "Message cannot be empty."})
                return
            if len(text) > settings.CHAT_MESSAGE_MAX_LENGTH:
                await self.send_json(
                    {
                        "type": "error",
                        "detail": f"Message is longer than {settings.CHAT_MESSAGE_MAX_LENGTH} characters.",
                    }
                )
                return
            message = await self.save_message(text)
            await self.broadcast("message", message=message)

        elif event_type == "typing":
            await self.broadcast(
                "typing",
                user=self.user.username,
                is_typing=bool(content.get("is_typing")),
                sender_channel=self.channel_name,
            )

        else:
            await self.send_json({"type": "error", "detail": "Unknown event type."})

    # --- group helpers -------------------------------------------------

    async def broadcast(self, event, **payload):
        await self.channel_layer.group_send(
            self.group_name, {"type": "relay.event", "event": event, **payload}
        )

    async def relay_event(self, event):
        """Handler for everything sent with `broadcast` (Channels maps relay.event -> relay_event)."""
        # Don't echo someone's own typing indicator back to them.
        if event["event"] == "typing" and event.get("sender_channel") == self.channel_name:
            return
        payload = {k: v for k, v in event.items() if k not in ("type", "event", "sender_channel")}
        await self.send_json({"type": event["event"], **payload})

    # --- database helpers ----------------------------------------------

    @database_sync_to_async
    def get_room(self, slug):
        return Room.objects.filter(slug=slug).first()

    @database_sync_to_async
    def save_message(self, text):
        message = Message.objects.create(room=self.room, author=self.user, content=text)
        return MessageSerializer(message).data
