"""Create a demo account and a few starter rooms. Safe to run on every deploy.

    python manage.py seed_demo
"""

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from chat.models import Message, Room

ROOMS = [
    (
        "General",
        "Anything and everything",
        "Welcome to Relay 👋 Open this page in a second browser (or incognito) with another account to see messages arrive in real time.",
    ),
    ("Introductions", "Say hi and tell us what you're building", "New here? Introduce yourself!"),
    ("Help", "Questions about the app", "Found a bug or have an idea? Drop it here."),
]


class Command(BaseCommand):
    help = "Create the demo user and starter rooms (idempotent)."

    def handle(self, *args, **options):
        username = os.environ.get("DEMO_USERNAME", "demo")
        password = os.environ.get("DEMO_PASSWORD", "Demo-pass-123")

        User = get_user_model()
        demo, created = User.objects.get_or_create(username=username)
        # Always reset the password so the credentials in the README keep working.
        demo.set_password(password)
        demo.save()
        self.stdout.write(f"{'Created' if created else 'Updated'} demo user '{username}'.")

        for name, description, welcome in ROOMS:
            room, room_created = Room.objects.get_or_create(
                name=name, defaults={"description": description, "created_by": demo}
            )
            if room_created:
                Message.objects.create(room=room, author=demo, content=welcome)
                self.stdout.write(f"Created room '{name}'.")
