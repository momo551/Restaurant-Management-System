from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from tenants.models import Restaurant

from .models import WebsiteSettings
from .serializers import PublicTestimonialSerializer


class PublicWebsiteView(APIView):
    """Public, read-only snapshot of the PUBLISHED website settings + testimonials.

    Unpublished drafts and hidden testimonials are never exposed here.
    """
    permission_classes = [AllowAny]

    def get(self, request, restaurant_slug=None):
        restaurant = get_object_or_404(
            Restaurant.objects.filter(is_active=True),
            slug=restaurant_slug,
        )

        try:
            settings_obj = restaurant.website_settings
        except WebsiteSettings.DoesNotExist:
            settings_obj = None

        if settings_obj and settings_obj.is_published and settings_obj.published_content:
            settings_data = settings_obj.get_published_content()
        else:
            # Safe defaults until the restaurant publishes for the first time.
            settings_data = WebsiteSettings().get_published_content()
            settings_data['display_name'] = restaurant.name

        testimonials = restaurant.website_testimonials.filter(is_published=True)
        return Response({
            'restaurant': {
                'id': restaurant.id,
                'name': restaurant.name,
                'slug': restaurant.slug,
            },
            'settings': settings_data,
            'is_published': bool(settings_obj and settings_obj.is_published),
            'testimonials': PublicTestimonialSerializer(testimonials, many=True).data,
        })
