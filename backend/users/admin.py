from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, ActivityLog
from tenants.models import Restaurant


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'role', 'restaurant', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at', 'restaurant']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-created_at']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('معلومات إضافية', {'fields': ('role', 'phone', 'restaurant')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('معلومات إضافية', {'fields': ('role', 'phone', 'restaurant')}),
    )

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
                    kwargs['queryset'] = Restaurant.objects.filter(id=request.user.restaurant.id)
                    kwargs['initial'] = request.user.restaurant
                else:
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


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'model_name', 'created_at']
    list_filter = ['action', 'model_name', 'created_at']
    search_fields = ['user__username', 'description']
    readonly_fields = ['user', 'action', 'model_name', 'object_id', 'description', 'ip_address', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(user__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'user':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    from .models import User
                    kwargs['queryset'] = User.objects.filter(restaurant=request.user.restaurant)
                else:
                    from .models import User
                    kwargs['queryset'] = User.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
