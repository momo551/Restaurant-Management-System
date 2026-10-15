from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Restaurant
from .serializers import RestaurantSerializer, RestaurantSummarySerializer


class IsSuperUserOrReadOnlyOwn(permissions.BasePermission):
    """
    Superusers can perform all operations.
    Authenticated users can view/retrieve their own assigned restaurant.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        # Read-only actions or self-restaurant view for authenticated users
        return view.action in ['list', 'retrieve', 'my_restaurant']

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        user_restaurant = getattr(request.user, 'restaurant', None)
        return user_restaurant and user_restaurant.id == obj.id


class RestaurantViewSet(viewsets.ModelViewSet):
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer
    permission_classes = [IsSuperUserOrReadOnlyOwn]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Restaurant.objects.all()
        user_restaurant = getattr(user, 'restaurant', None)
        if user_restaurant:
            return Restaurant.objects.filter(id=user_restaurant.id)
        return Restaurant.objects.none()

    @action(detail=False, methods=['get'], url_path='my-restaurant')
    def my_restaurant(self, request):
        """Return the current user's restaurant details."""
        user_restaurant = getattr(request.user, 'restaurant', None)
        if not user_restaurant:
            return Response(
                {'detail': 'لا يوجد مطعم مرتبط بهذا المستخدم.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(user_restaurant)
        return Response(serializer.data)


class PublicRestaurantView(viewsets.ReadOnlyModelViewSet):
    """
    Public read-only endpoint for resolving restaurant details by slug or uuid.
    Used by customer-facing QR menu or web ordering.
    """
    queryset = Restaurant.objects.filter(is_active=True)
    serializer_class = RestaurantSummarySerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'slug'
