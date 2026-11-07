from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TestimonialViewSet, WebsitePublishView, WebsiteSettingsView

router = DefaultRouter()
router.register('testimonials', TestimonialViewSet, basename='website-testimonials')

urlpatterns = [
    path('settings/', WebsiteSettingsView.as_view(), name='website-settings'),
    path('settings/publish/', WebsitePublishView.as_view(), name='website-settings-publish'),
    path('', include(router.urls)),
]
