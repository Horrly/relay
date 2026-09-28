from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Room
from .serializers import MessageSerializer, RoomSerializer

HISTORY_PAGE_SIZE = 50


class RoomViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Room.objects.select_related("created_by")
    serializer_class = RoomSerializer
    lookup_field = "slug"

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def messages(self, request, slug=None):
        """Message history, newest page first.

        Pass `?before=<message id>` to load older messages (infinite scroll).
        Results are returned oldest -> newest so the client can render them directly.
        """
        room = get_object_or_404(Room, slug=slug)
        qs = room.messages.select_related("author").order_by("-id")

        before = request.query_params.get("before")
        if before:
            if not before.isdigit():
                return Response({"detail": "`before` must be a message id."}, status=400)
            qs = qs.filter(id__lt=int(before))

        page = list(qs[: HISTORY_PAGE_SIZE + 1])
        has_more = len(page) > HISTORY_PAGE_SIZE
        page = page[:HISTORY_PAGE_SIZE]
        page.reverse()

        return Response(
            {"results": MessageSerializer(page, many=True).data, "has_more": has_more}
        )
