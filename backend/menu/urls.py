from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, MenuItemViewSet, ProductOfferViewSet

router = DefaultRouter()
router.register('categories', CategoryViewSet, basename='categories')
router.register('items', MenuItemViewSet, basename='menu-items')
router.register('offers', ProductOfferViewSet, basename='product-offers')

urlpatterns = [
    path('', include(router.urls)),
]
