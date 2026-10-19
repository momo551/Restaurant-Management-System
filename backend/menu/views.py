from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import ProtectedError
from .models import Category, MenuItem, ProductOffer
from .serializers import CategorySerializer, CategoryListSerializer, MenuItemSerializer, ProductOfferSerializer
from users.permissions import HasMenuAccess, IsStaff
from users.audit import log_action, serialize_instance
from users.models import ActivityLog
from django.core.cache import cache


class CategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for Category management."""
    queryset = Category.objects.filter(is_deleted=False).prefetch_related('items')
    permission_classes = [HasMenuAccess]
    
    def get_queryset(self):
        user = self.request.user
        qs = Category.objects.filter(is_deleted=False).prefetch_related('items')
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return CategoryListSerializer
        return CategorySerializer

    def get_permissions(self):
        return [HasMenuAccess()]

    def list(self, request, *args, **kwargs):
        restaurant_id = getattr(request.user, 'restaurant_id', 'anon')
        cache_key = f'active_menu_categories_{restaurant_id}'
        try:
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)
        except Exception:
            pass # Fallback to DB if cache fails
        
        response = super().list(request, *args, **kwargs)
        try:
            cache.set(cache_key, response.data, 60 * 15) # Cache for 15 minutes
        except Exception:
            pass
        return response

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()
        cache.clear()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()
        cache.clear()

    def destroy(self, request, *args, **kwargs):
        from django.utils import timezone
        instance = self.get_object()
        if not request.user.is_superuser:
            if instance.restaurant_id != request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot delete data belonging to another restaurant.")
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()
        
        # Cascade soft delete to items in this category
        instance.items.all().update(
            is_deleted=True, 
            deleted_at=timezone.now()
        )
        cache.delete('active_menu_categories')
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def active(self, request):
        """Get only active categories with available items."""
        categories = self.get_queryset().filter(is_active=True).prefetch_related('items')
        serializer = CategorySerializer(categories, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[HasMenuAccess])
    def toggle_items(self, request, pk=None):
        """Toggle availability of all items in this category."""
        category = self.get_object()
        is_available = request.data.get('is_available', False)
        
        # Update all items in this category
        category.items.all().update(is_available=is_available)
        
        return Response({
            'status': 'success',
            'category': category.name,
            'is_available': is_available,
            'count': category.items.count()
        })


class MenuItemViewSet(viewsets.ModelViewSet):
    """ViewSet for MenuItem management."""
    queryset = MenuItem.objects.filter(is_deleted=False).select_related('category')
    serializer_class = MenuItemSerializer
    permission_classes = [HasMenuAccess]
    filterset_fields = ['category', 'is_available']
    search_fields = ['name', 'name_en', 'description']

    def get_queryset(self):
        user = self.request.user
        qs = MenuItem.objects.filter(is_deleted=False).select_related('category')
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(category__restaurant_id=user.restaurant_id)
        return qs.none()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [HasMenuAccess()]

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_superuser:
            if instance.category.restaurant_id != request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        old_data = serialize_instance(instance, fields=['name', 'price', 'is_available'])
        response = super().update(request, *args, **kwargs)
        instance.refresh_from_db()
        new_data = serialize_instance(instance, fields=['name', 'price', 'is_available'])
        
        # Check if price changed
        if str(old_data.get('price')) != str(new_data.get('price')):
            log_action(
                user=request.user,
                action=ActivityLog.ActionType.PRICE_CHANGE,
                instance=instance,
                old_data={'price': old_data.get('price')},
                new_data={'price': new_data.get('price')},
                description=f"طھط؛ظٹظٹط± ط³ط¹ط± '{instance.name}' ظ…ظ† {old_data.get('price')} ط¥ظ„ظ‰ {new_data.get('price')}",
                request=request,
            )
        return response

    def destroy(self, request, *args, **kwargs):
        from django.utils import timezone
        instance = self.get_object()
        old_data = serialize_instance(instance, fields=['name', 'price'])
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save()
        log_action(
            user=request.user,
            action=ActivityLog.ActionType.DELETE,
            instance=instance,
            old_data=old_data,
            description=f"ط­ط°ظپ طµظ†ظپ '{instance.name}'",
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], permission_classes=[HasMenuAccess])
    def toggle_availability(self, request, pk=None):
        """Toggle item availability."""
        item = self.get_object()
        item.is_available = not item.is_available
        item.save()
        return Response({
            'id': item.id,
            'name': item.name,
            'is_available': item.is_available
        })

    @action(detail=False, methods=['post'], permission_classes=[HasMenuAccess])
    def update_price(self, request):
        """Bulk update prices with audit logging."""
        items_data = request.data.get('items', [])
        updated = []
        
        # Get user's restaurant for tenant filtering
        user_restaurant = getattr(request.user, 'restaurant', None)
        if not user_restaurant and not request.user.is_superuser:
            return Response({'error': 'المستخدم غير مرتبط بمطعم'}, status=status.HTTP_403_FORBIDDEN)
        
        for item_data in items_data:
            try:
                # Filter by restaurant to prevent cross-tenant access
                item_queryset = MenuItem.objects.filter(id=item_data['id'])
                if user_restaurant:
                    item_queryset = item_queryset.filter(category__restaurant=user_restaurant)
                
                item = item_queryset.get()
                old_price = str(item.price)
                item.price = item_data['price']
                item.save()
                log_action(
                    user=request.user,
                    action=ActivityLog.ActionType.PRICE_CHANGE,
                    instance=item,
                    old_data={'price': old_price},
                    new_data={'price': str(item.price)},
                    description=f"طھط؛ظٹظٹط± ط³ط¹ط± ({item.name}) ظ…ظ† {old_price} ط¥ظ„ظ‰ {item.price}",
                    request=request,
                )
                updated.append({'id': item.id, 'name': item.name, 'price': str(item.price)})
            except MenuItem.DoesNotExist:
                continue
        return Response({'updated': updated})


class ProductOfferViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Product Offers."""
    queryset = ProductOffer.objects.all().select_related('product')
    serializer_class = ProductOfferSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = ProductOffer.objects.all().select_related('product')
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(product__category__restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.product.category.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    def create(self, request, *args, **kwargs):
        """Allow creating multiple offers at once if 'products' is provided."""
        if 'products' in request.data and isinstance(request.data['products'], list):
            products = request.data.pop('products')
            errors = []
            valid_serializers = []
            
            for product_id in products:
                data = request.data.copy()
                data['product'] = product_id
                serializer = self.get_serializer(data=data)
                if serializer.is_valid():
                    valid_serializers.append(serializer)
                else:
                    errors.append({'product_id': product_id, 'errors': serializer.errors})
            
            if errors:
                return Response({'message': 'فشل التحقق لبعض المنتجات، يرجى مراجعة الخصم.', 'details': errors}, status=status.HTTP_400_BAD_REQUEST)
                
            results = []
            for serializer in valid_serializers:
                serializer.save()
                results.append(serializer.data)
            return Response(results, status=status.HTTP_201_CREATED)
            
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[IsStaff])
    def toggle_active(self, request, pk=None):
        """Toggle active status."""
        offer = self.get_object()
        offer.is_active = not offer.is_active
        offer.save()
        return Response({
            'id': offer.id,
            'is_active': offer.is_active,
            'message': f"تم {'تفعيل' if offer.is_active else 'إيقاف'} العرض بنجاح"
        })


