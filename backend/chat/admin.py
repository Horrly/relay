from django.contrib import admin

from .models import Message, Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "created_by", "created_at"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["room", "author", "content", "created_at"]
    list_filter = ["room"]
