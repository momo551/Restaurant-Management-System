from django.contrib import admin
from .models import Customer, LoyaltyPoint, Coupon, Campaign

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'points_balance', 'total_spent', 'created_at')
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

@admin.register(LoyaltyPoint)
class LoyaltyPointAdmin(admin.ModelAdmin):
    list_display = ('customer', 'points', 'transaction_type', 'created_at')
    list_filter = ('transaction_type',)
    search_fields = ('customer__name', 'customer__phone')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(customer__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'customer':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Customer.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Customer.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.customer.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.customer.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_amount', 'is_active', 'valid_until')
    list_filter = ('is_active', 'discount_type')
    search_fields = ('code',)

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
        elif db_field.name == 'customer':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Customer.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Customer.objects.none()
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

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'multiplier', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)

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
