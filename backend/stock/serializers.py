from rest_framework import serializers
from .models import (
    Ingredient, Recipe, Supplier, PurchaseOrder, PurchaseOrderItem, StockMovement,
    LowStockAlert, WasteLog
)

class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'unit', 'quantity', 'reorder_level', 'last_purchase_price', 'is_active', 'created_at', 'updated_at', 'restaurant']
        read_only_fields = ['id', 'quantity', 'created_at', 'updated_at', 'restaurant']


class RecipeSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.ReadOnlyField(source='ingredient.name')
    menu_item_name = serializers.ReadOnlyField(source='menu_item.name')
    ingredient_cost = serializers.ReadOnlyField(source='ingredient.last_purchase_price')
    total_ingredient_cost = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = ['id', 'menu_item', 'menu_item_name', 'ingredient', 'ingredient_name', 'quantity_required', 'ingredient_cost', 'total_ingredient_cost']

    def get_total_ingredient_cost(self, obj):
        if obj.ingredient.last_purchase_price:
            return obj.quantity_required * obj.ingredient.last_purchase_price
        return 0

class MenuItemRecipeSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='menu_item.id')
    name = serializers.CharField(source='menu_item.name')
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2)
    ingredients = RecipeSerializer(many=True, source='recipes')

class SupplierSerializer(serializers.ModelSerializer):
    ingredient_names = serializers.StringRelatedField(source='ingredients', many=True, read_only=True)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'address', 'notes', 'ingredients', 'ingredient_names', 'restaurant']
        read_only_fields = ['id', 'restaurant']

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.ReadOnlyField(source='ingredient.name')
    unit = serializers.ReadOnlyField(source='ingredient.unit')

    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'ingredient', 'ingredient_name', 'unit', 'quantity', 'price']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source='supplier.name')
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    user_name = serializers.ReadOnlyField(source='user.get_full_name')

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'supplier_name', 'status', 'user', 'user_name', 'items', 'created_at', 'updated_at']

class StockMovementSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.ReadOnlyField(source='ingredient.name')
    user_name = serializers.ReadOnlyField(source='user.get_full_name')
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = StockMovement
        fields = ['id', 'ingredient', 'ingredient_name', 'quantity', 'type', 'type_display', 'user', 'user_name', 'notes', 'created_at']
        read_only_fields = ['id', 'created_at']

class LowStockAlertSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit', read_only=True)
    current_quantity = serializers.DecimalField(source='ingredient.quantity', max_digits=10, decimal_places=3, read_only=True)
    reorder_level = serializers.DecimalField(source='ingredient.reorder_level', max_digits=10, decimal_places=3, read_only=True)
    supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = LowStockAlert
        fields = ['id', 'ingredient', 'ingredient_name', 'ingredient_unit', 'current_quantity', 'reorder_level', 'supplier_name', 'is_resolved', 'created_at', 'resolved_at']
        read_only_fields = ['id', 'created_at', 'resolved_at']

    def get_supplier_name(self, obj):
        supplier = obj.ingredient.suppliers.first()
        return supplier.name if supplier else None

class WasteLogSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source='ingredient.name', read_only=True)
    ingredient_unit = serializers.CharField(source='ingredient.unit', read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    total_cost = serializers.SerializerMethodField()

    class Meta:
        model = WasteLog
        fields = ['id', 'ingredient', 'ingredient_name', 'ingredient_unit', 'quantity', 'reason', 'reason_display', 'recorded_by', 'recorded_by_name', 'cost_at_time', 'total_cost', 'created_at']
        read_only_fields = ['id', 'recorded_by', 'cost_at_time', 'created_at']

    def get_recorded_by_name(self, obj):
        return obj.recorded_by.get_full_name() or obj.recorded_by.username if obj.recorded_by else 'System'
        
    def get_total_cost(self, obj):
        if obj.cost_at_time is not None and obj.quantity is not None:
            return float(obj.cost_at_time) * float(obj.quantity)
        return 0
