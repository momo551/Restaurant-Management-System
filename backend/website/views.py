from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.models import Restaurant
from users.audit import log_action
from users.models import ActivityLog
from users.permissions import HasWebsiteAccess

from .models import Testimonial, WebsiteSettings, merge_content
from .serializers import TestimonialSerializer, WebsiteSettingsSerializer


def get_request_restaurant(request):
    """Resolve the tenant strictly from the authenticated user.

    Client-supplied restaurant ids/slugs are never trusted. Superusers without an
    assigned restaurant may pass ``?restaurant_id=`` explicitly.
    """
    user = request.user
    if user.is_superuser and not getattr(user, 'restaurant', None):
        restaurant_id = request.query_params.get('restaurant_id') or request.data.get('restaurant_id')
        if restaurant_id:
            return Restaurant.objects.filter(id=restaurant_id).first()
        return None
    return getattr(user, 'restaurant', None)


class WebsiteSettingsView(APIView):
    """Read/update the website settings DRAFT for the current user's restaurant."""
    permission_classes = [HasWebsiteAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_settings(self, request):
        restaurant = get_request_restaurant(request)
        if restaurant is None:
            return None, Response(
                {'detail': 'لا يوجد مطعم مرتبط بهذا المستخدم.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings_obj, _ = WebsiteSettings.objects.get_or_create(restaurant=restaurant)
        return settings_obj, None

    def get(self, request):
        settings_obj, error = self._get_settings(request)
        if error:
            return error
        return Response(WebsiteSettingsSerializer(settings_obj, context={'request': request}).data)

    def patch(self, request):
        return self._update(request)

    def put(self, request):
        return self._update(request)

    def _update(self, request):
        settings_obj, error = self._get_settings(request)
        if error:
            return error

        old_content = settings_obj.content
        serializer = WebsiteSettingsSerializer(
            settings_obj, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        # Keep only schema keys in the draft so arbitrary JSON cannot accumulate.
        # Guard on dict: a multipart request may deliver `content` as a raw string.
        raw_content = request.data.get('content')
        if isinstance(raw_content, dict):
            instance.content = merge_content(raw_content)
            instance.save(update_fields=['content', 'updated_at'])

        log_action(
            user=request.user,
            action=ActivityLog.ActionType.UPDATE,
            instance=instance,
            old_data={'content': old_content},
            new_data={'content': instance.content},
            description='تحديث مسودة إعدادات موقع العميل',
            request=request,
        )
        return Response(WebsiteSettingsSerializer(instance, context={'request': request}).data)


class WebsitePublishView(APIView):
    """Publish the current draft: snapshot content + resolve absolute image URLs."""
    permission_classes = [HasWebsiteAccess]

    def post(self, request):
        restaurant = get_request_restaurant(request)
        if restaurant is None:
            return Response(
                {'detail': 'لا يوجد مطعم مرتبط بهذا المستخدم.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings_obj, _ = WebsiteSettings.objects.get_or_create(restaurant=restaurant)

        published = settings_obj.get_draft_content()
        # Fall back to the restaurant record for the public display name.
        if not published.get('display_name'):
            published['display_name'] = restaurant.name

        # Resolve image URLs to absolute links so the snapshot works for every visitor.
        for field, key in (('logo', 'logo_url'), ('hero_image', 'hero_image_url')):
            image = getattr(settings_obj, field)
            if image:
                try:
                    published[key] = request.build_absolute_uri(image.url)
                except Exception:
                    published[key] = image.url
            else:
                published[key] = ''

        settings_obj.published_content = published
        settings_obj.is_published = True
        settings_obj.published_at = timezone.now()
        settings_obj.save(update_fields=['published_content', 'is_published', 'published_at', 'updated_at'])

        log_action(
            user=request.user,
            action=ActivityLog.ActionType.UPDATE,
            instance=settings_obj,
            new_data={'published_at': settings_obj.published_at.isoformat()},
            description='نشر إعدادات موقع العميل',
            request=request,
        )

        return Response(WebsiteSettingsSerializer(settings_obj, context={'request': request}).data)


class TestimonialViewSet(viewsets.ModelViewSet):
    """CRUD for admin-curated testimonials, scoped to the user's restaurant."""
    serializer_class = TestimonialSerializer
    permission_classes = [HasWebsiteAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = Testimonial.objects.select_related('restaurant').all()
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            restaurant_id = self.request.query_params.get('restaurant_id')
            if restaurant_id:
                return qs.filter(restaurant_id=restaurant_id)
            return qs
        restaurant = getattr(user, 'restaurant', None)
        if restaurant:
            return qs.filter(restaurant=restaurant)
        return qs.none()

    def _check_tenant(self, instance):
        user = self.request.user
        if not user.is_superuser and instance.restaurant_id != getattr(user, 'restaurant_id', None):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('لا يمكنك تعديل بيانات مطعم آخر.')

    def perform_create(self, serializer):
        serializer.save(
            restaurant=get_request_restaurant(self.request),
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        self._check_tenant(self.get_object())
        serializer.save()

    def perform_destroy(self, instance):
        self._check_tenant(instance)
        instance.delete()

    def create(self, request, *args, **kwargs):
        if get_request_restaurant(request) is None:
            return Response(
                {'detail': 'لا يوجد مطعم مرتبط بهذا المستخدم.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        testimonial = self.get_object()
        self._check_tenant(testimonial)
        testimonial.is_published = True
        testimonial.save(update_fields=['is_published', 'updated_at'])
        return Response(TestimonialSerializer(testimonial).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        testimonial = self.get_object()
        self._check_tenant(testimonial)
        testimonial.is_published = False
        testimonial.save(update_fields=['is_published', 'updated_at'])
        return Response(TestimonialSerializer(testimonial).data)
