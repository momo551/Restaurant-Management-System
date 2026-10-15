from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IngredientViewSet, RecipeViewSet, SupplierViewSet, 
    PurchaseOrderViewSet, StockMovementViewSet, LowStockAlertViewSet, WasteLogViewSet
)

router = DefaultRouter()
router.register(r'ingredients', IngredientViewSet)
router.register(r'recipes', RecipeViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'purchase-orders', PurchaseOrderViewSet)
router.register(r'movements', StockMovementViewSet)
router.register(r'alerts', LowStockAlertViewSet, basename='lowstockalert')
router.register(r'waste', WasteLogViewSet, basename='wastelog')

urlpatterns = [
    path('', include(router.urls)),
]

