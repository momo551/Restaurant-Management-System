from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet, LoyaltyPointViewSet, CouponViewSet, CampaignViewSet

router = DefaultRouter()
router.register('customers', CustomerViewSet, basename='customers')
router.register('points', LoyaltyPointViewSet, basename='loyalty-points')
router.register('coupons', CouponViewSet, basename='coupons')
router.register('campaigns', CampaignViewSet, basename='campaigns')


urlpatterns = [
    path('', include(router.urls)),
]
