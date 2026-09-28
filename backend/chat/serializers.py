from django.utils.text import slugify
from rest_framework import serializers

from .models import Message, Room


class RoomSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = Room
        fields = ["id", "name", "slug", "description", "created_by", "created_at"]
        read_only_fields = ["slug", "created_at"]

    def validate_name(self, value):
        value = value.strip()
        slug = slugify(value)
        if not slug:
            raise serializers.ValidationError("Room name must contain letters or numbers.")
        if Room.objects.filter(slug=slug).exists():
            raise serializers.ValidationError("A room with a similar name already exists.")
        return value


class MessageSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author.username", read_only=True)

    class Meta:
        model = Message
        fields = ["id", "author", "content", "created_at"]
