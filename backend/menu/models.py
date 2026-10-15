from django.db import models
from django.utils import timezone
from decimal import Decimal


class Category(models.Model):
    """Menu category (مشروبات، أكلات، حلويات، إلخ)."""
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='categories',
        verbose_name='المطعم'
    )
    name = models.CharField(max_length=100, verbose_name='اسم الفئة')
    name_en = models.CharField(max_length=100, blank=True, verbose_name='الاسم بالإنجليزية')
    description = models.TextField(blank=True, verbose_name='الوصف')
    image = models.ImageField(upload_to='categories/', blank=True, null=True, verbose_name='الصورة')
    display_order = models.PositiveIntegerField(default=0, verbose_name='ترتيب العرض')
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    is_deleted = models.BooleanField(default=False, verbose_name='محذوف')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الحذف')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'فئة'
        verbose_name_plural = 'الفئات'
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    """Menu item (صنف في المنيو)."""
    
    category = models.ForeignKey(
        Category, 
        on_delete=models.CASCADE, 
        related_name='items',
        verbose_name='الفئة'
    )
    name = models.CharField(max_length=200, verbose_name='اسم الصنف')
    name_en = models.CharField(max_length=200, blank=True, verbose_name='الاسم بالإنجليزية')
    description = models.TextField(blank=True, verbose_name='الوصف')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='السعر')
    image = models.ImageField(upload_to='menu_items/', blank=True, null=True, verbose_name='الصورة')
    is_available = models.BooleanField(default=True, verbose_name='متاح')
    preparation_time = models.PositiveIntegerField(default=15, verbose_name='وقت التحضير (دقيقة)')
    display_order = models.PositiveIntegerField(default=0, verbose_name='ترتيب العرض')
    is_deleted = models.BooleanField(default=False, verbose_name='محذوف')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الحذف')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'صنف'
        verbose_name_plural = 'الأصناف'
        ordering = ['category', 'display_order', 'name']

    @property
    def production_cost(self):
        """Calculate the total production cost based on recipes."""
        total = 0
        for recipe in self.recipes.all():
            if recipe.ingredient.last_purchase_price:
                total += recipe.quantity_required * recipe.ingredient.last_purchase_price
        return total

    def __str__(self):
        return f"{self.name} - {self.price} جنيه"


class ProductOffer(models.Model):
    """Time-limited discount offer on a specific menu item."""
    name = models.CharField(max_length=150, blank=True, null=True, verbose_name='اسم العرض')
    product = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name='offers',
        verbose_name='الصنف'
    )
    discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        verbose_name='نسبة الخصم %',
        help_text='مثال: 20 تعني 20% خصم'
    )
    points_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.0,
        verbose_name='مضاعف النقاط',
        help_text='مثال: 2 تعني نقاط مضاعفة'
    )
    start_date = models.DateTimeField(verbose_name='تاريخ البداية')
    end_date = models.DateTimeField(verbose_name='تاريخ النهاية')
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'عرض صنف'
        verbose_name_plural = 'عروض الأصناف'
        ordering = ['-start_date']

    def __str__(self):
        return f"عرض {self.product.name} - {self.discount_percentage}% خصم"

    @property
    def is_currently_active(self):
        now = timezone.now()
        return self.is_active and self.start_date <= now <= self.end_date

    @property
    def discounted_price(self):
        if self.is_currently_active and self.discount_percentage > 0:
            discount = self.product.price * (self.discount_percentage / Decimal('100'))
            return (self.product.price - discount).quantize(Decimal('0.01'))
        return self.product.price

    @classmethod
    def get_active_offer_for_item(cls, menu_item_id):
        now = timezone.now()
        return cls.objects.filter(
            product_id=menu_item_id,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now
        ).first()

    @classmethod
    def get_all_active_offers(cls):
        now = timezone.now()
        return cls.objects.filter(
            is_active=True,
            start_date__lte=now,
            end_date__gte=now
        ).select_related('product')
