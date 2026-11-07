from django.urls import path

from .public_views import PublicWebsiteView

urlpatterns = [
    path('<slug:restaurant_slug>/website/', PublicWebsiteView.as_view(), name='public-website'),
]
