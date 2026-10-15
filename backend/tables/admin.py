from django.contrib import admin
from .models import Table, Reservation


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['number', 'capacity', 'status', 'floor', 'is_active']
    list_filter = ['status', 'floor', 'is_active']
    search_fields = ['number', 'notes']

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


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'table', 'reservation_time', 'guests_count', 'is_confirmed']
    list_filter = ['is_confirmed', 'reservation_time']
    search_fields = ['customer_name', 'customer_phone']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(table__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'table':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Table.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Table.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.table.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.table.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)
