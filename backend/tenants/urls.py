from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RestaurantViewSet, PublicRestaurantView

router = DefaultRouter()
router.register(r'restaurants', RestaurantViewSet, basename='restaurant')
router.register(r'public/restaurants', PublicRestaurantView, basename='public-restaurant')

urlpatterns = [
    path('', include(router.urls)),
]
