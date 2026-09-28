from django.contrib import admin
from django.urls import include, path, re_path

from .views import health, spa

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("chat.urls")),
    # Everything else is a React route.
    re_path(r"^(?!api/|admin/|static/|ws/).*$", spa, name="spa"),
]
