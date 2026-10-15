from django.urls import path
from .public_views import (
    PublicMenuView, 
    PublicOrderCreateView, 
    PublicOrderTrackView,
    PublicCampaignView,
    PublicCustomerInfoView,
    PublicOffersView,
    PublicApplyCouponView,
)

urlpatterns = [
    path('<slug:restaurant_slug>/menu/', PublicMenuView.as_view(), name='public-menu'),
    path('<slug:restaurant_slug>/orders/', PublicOrderCreateView.as_view(), name='public-order-create'),
    path('<slug:restaurant_slug>/track/<str:order_number>/', PublicOrderTrackView.as_view(), name='public-order-track'),
    path('<slug:restaurant_slug>/loyalty/campaigns/active/', PublicCampaignView.as_view(), name='public-campaign-active'),
    path('<slug:restaurant_slug>/loyalty/customer-info/', PublicCustomerInfoView.as_view(), name='public-customer-info'),
    path('<slug:restaurant_slug>/offers/', PublicOffersView.as_view(), name='public-offers'),
    path('<slug:restaurant_slug>/apply-coupon/', PublicApplyCouponView.as_view(), name='public-apply-coupon'),
]
