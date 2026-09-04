"""URL configuration for the DairyDesk config project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("health.urls")),
    path("api/", include("core.urls")),
    # Session login/logout for the DRF browsable API.
    path("api-auth/", include("rest_framework.urls")),
]

# Product photos. static() is a no-op unless DEBUG, so production still needs a
# real file server in front of MEDIA_ROOT.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
