from django.contrib import admin
from .models import Ingredient, Recipe, Supplier, PurchaseOrder, PurchaseOrderItem, StockMovement

@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'quantity', 'unit', 'reorder_level', 'is_active', 'updated_at')
    search_fields = ('name',)
    list_filter = ('unit', 'is_active')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'restaurant':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from tenants.models import Restaurant
                    kwargs['queryset'] = Restaurant.objects.filter(id=request.user.restaurant.id)
                    kwargs['initial'] = request.user.restaurant
                else:
                    from tenants.models import Restaurant
                    kwargs['queryset'] = Restaurant.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

class RecipeInline(admin.TabularInline):
    model = Recipe
    extra = 1

@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('menu_item', 'ingredient', 'quantity_required')
    search_fields = ('menu_item__name', 'ingredient__name')
    list_filter = ('menu_item__category',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(menu_item__category__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'menu_item':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from menu.models import MenuItem
                    kwargs['queryset'] = MenuItem.objects.filter(category__restaurant=request.user.restaurant)
                else:
                    from menu.models import MenuItem
                    kwargs['queryset'] = MenuItem.objects.none()
        elif db_field.name == 'ingredient':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Ingredient.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Ingredient.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.menu_item.category.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.menu_item.category.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone')
    search_fields = ('name', 'phone')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'restaurant':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from tenants.models import Restaurant
                    kwargs['queryset'] = Restaurant.objects.filter(id=request.user.restaurant.id)
                    kwargs['initial'] = request.user.restaurant
                else:
                    from tenants.models import Restaurant
                    kwargs['queryset'] = Restaurant.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'ingredients':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Ingredient.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Ingredient.objects.none()
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1

@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'supplier', 'status', 'user', 'created_at')
    list_filter = ('status', 'created_at')
    inlines = [PurchaseOrderItemInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(supplier__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'supplier':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Supplier.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Supplier.objects.none()
        elif db_field.name == 'user':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from users.models import User
                    kwargs['queryset'] = User.objects.filter(restaurant=request.user.restaurant)
                else:
                    from users.models import User
                    kwargs['queryset'] = User.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.supplier.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.supplier.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('ingredient', 'quantity', 'type', 'user', 'created_at')
    list_filter = ('type', 'created_at')
    search_fields = ('ingredient__name', 'notes')
    readonly_fields = ('created_at',)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(ingredient__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'ingredient':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Ingredient.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Ingredient.objects.none()
        elif db_field.name == 'user':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from users.models import User
                    kwargs['queryset'] = User.objects.filter(restaurant=request.user.restaurant)
                else:
                    from users.models import User
                    kwargs['queryset'] = User.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.ingredient.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.ingredient.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

