from django.contrib import admin
from .models import Restaurant


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'slug', 'phone', 'address']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['uuid', 'created_at', 'updated_at']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(id=request.user.restaurant.id)
        return qs.none()
