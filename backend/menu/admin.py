from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import Category, MenuItem, ProductOffer


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'name_en', 'display_order', 'is_active', 'items_count')
    list_filter = ('is_active',)
    search_fields = ('name', 'name_en')
    ordering = ('display_order',)

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

    def items_count(self, obj):
        return obj.items.filter(is_deleted=False).count()
    items_count.short_description = 'عدد الأصناف'


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_available', 'has_active_offer')
    list_filter = ('category', 'is_available', 'is_deleted')
    search_fields = ('name', 'name_en')
    ordering = ('category', 'display_order')

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(category__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'category':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = Category.objects.filter(restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = Category.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.category.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.category.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

    def has_active_offer(self, obj):
        offer = ProductOffer.get_active_offer_for_item(obj.id)
        if offer:
            return format_html('<span style="color:green;font-weight:bold;">✔ {}%</span>', offer.discount_percentage)
        return format_html('<span style="color:grey;">—</span>')
    has_active_offer.short_description = 'عرض نشط'


class OfferStatusFilter(admin.SimpleListFilter):
    title = 'حالة العرض'
    parameter_name = 'offer_status'

    def lookups(self, request, model_admin):
        return [
            ('active_now', 'نشط الآن'),
            ('scheduled', 'مجدول'),
            ('expired', 'منتهي'),
        ]

    def queryset(self, request, queryset):
        now = timezone.now()
        if self.value() == 'active_now':
            return queryset.filter(is_active=True, start_date__lte=now, end_date__gte=now)
        if self.value() == 'scheduled':
            return queryset.filter(is_active=True, start_date__gt=now)
        if self.value() == 'expired':
            return queryset.filter(end_date__lt=now)
        return queryset


@admin.register(ProductOffer)
class ProductOfferAdmin(admin.ModelAdmin):
    list_display = (
        'product', 'discount_percentage', 'points_multiplier',
        'start_date', 'end_date', 'is_active', 'status_badge'
    )
    list_filter = ('is_active', OfferStatusFilter)
    search_fields = ('product__name',)
    date_hierarchy = 'start_date'
    autocomplete_fields = ['product']
    list_editable = ('is_active',)
    fieldsets = (
        ('الصنف', {'fields': ('product',)}),
        ('تفاصيل العرض', {
            'fields': ('discount_percentage', 'points_multiplier'),
            'description': 'نسبة الخصم (0 = لا خصم) | مضاعف النقاط (1 = عادي، 2 = ضعف)'
        }),
        ('الجدول الزمني', {'fields': ('start_date', 'end_date', 'is_active')}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        if hasattr(request.user, 'restaurant') and request.user.restaurant:
            return qs.filter(product__category__restaurant=request.user.restaurant)
        return qs.none()

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'product':
            if not request.user.is_superuser:
                if hasattr(request.user, 'restaurant') and request.user.restaurant:
                    kwargs['queryset'] = MenuItem.objects.filter(category__restaurant=request.user.restaurant)
                else:
                    kwargs['queryset'] = MenuItem.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.product.category.restaurant_id == request.user.restaurant.id
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is not None and hasattr(request.user, 'restaurant') and request.user.restaurant:
            return obj.product.category.restaurant_id == request.user.restaurant.id
        return super().has_delete_permission(request, obj)

    def status_badge(self, obj):
        now = timezone.now()
        if obj.is_active and obj.start_date <= now <= obj.end_date:
            return format_html('<span style="background:#22c55e;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;">🔥 نشط</span>')
        if obj.is_active and obj.start_date > now:
            return format_html('<span style="background:#f59e0b;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;">⏳ مجدول</span>')
        return format_html('<span style="background:#6b7280;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;">⛔ منتهي</span>')
    status_badge.short_description = 'الحالة'
