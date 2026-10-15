from django.db import models
from django.conf import settings
from menu.models import MenuItem
from django.core.validators import MinValueValidator

class Ingredient(models.Model):
    """Basic inventory item (e.g., Tomato, Beef Patty, Flour)."""
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='ingredients',
        verbose_name='المطعم'
    )
    name = models.CharField(max_length=100, verbose_name='اسم المكون')
    unit = models.CharField(max_length=20, verbose_name='الوحدة (كجم، لتر، قطعة)')
    quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=3, 
        default=0, 
        validators=[MinValueValidator(0)],
        verbose_name='الكمية المتوفرة'
    )
    reorder_level = models.DecimalField(max_digits=10, decimal_places=3, default=5, verbose_name='حد إعادة الطلب')
    last_purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True, verbose_name='آخر سعر شراء')
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'مكون'
        verbose_name_plural = 'المكونات'

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

    def save(self, *args, **kwargs):
        if self.quantity < 0:
            raise ValueError("Stock quantity cannot be negative.")
        super().save(*args, **kwargs)

class Supplier(models.Model):
    """Raw material suppliers."""
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='suppliers',
        verbose_name='المطعم'
    )
    name = models.CharField(max_length=200, verbose_name='اسم المورد')
    phone = models.CharField(max_length=20, verbose_name='رقم التليفون')
    address = models.TextField(blank=True, verbose_name='العنوان')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    ingredients = models.ManyToManyField(Ingredient, related_name='suppliers', blank=True, verbose_name='المكونات الموردة')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'مورد'
        verbose_name_plural = 'الموردين'

    def __str__(self):
        return self.name

class PurchaseOrder(models.Model):
    """Purchase orders for stock replenishment."""
    class Status(models.TextChoices):
        DRAFT = 'draft', 'مسودة'
        ORDERED = 'ordered', 'تم الطلب'
        RECEIVED = 'received', 'تم الاستلام'

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchase_orders', verbose_name='المورد')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='الحالة')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, verbose_name='المستخدم')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'أمر شراء'
        verbose_name_plural = 'أوامر الشراء'

    def __str__(self):
        return f"PO-{self.id} ({self.supplier.name})"

class PurchaseOrderItem(models.Model):
    """Items within a purchase order."""
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, verbose_name='الصنف')
    quantity = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='الكمية')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='السعر')

    class Meta:
        verbose_name = 'صنف أمر شراء'
        verbose_name_plural = 'أصناف أوامر الشراء'

class Recipe(models.Model):
    """Linking MenuItems to Ingredients with quantities."""
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='recipes', verbose_name='الصنف')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='used_in', verbose_name='المكون')
    quantity_required = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='الكمية المطلوبة لكل وحدة')

    class Meta:
        verbose_name = 'وصفة'
        verbose_name_plural = 'الوصفات'
        unique_together = ('menu_item', 'ingredient')

class StockMovement(models.Model):
    """Logging stock changes (Purchase, Order, Waste, Adjustment)."""
    class MovementType(models.TextChoices):
        IN = 'IN', 'وارد'
        OUT = 'OUT', 'صادر'
        ADJUSTMENT = 'ADJUSTMENT', 'تعديل جرد'

    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='movements', verbose_name='المكون')
    quantity = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='الكمية')
    type = models.CharField(max_length=20, choices=MovementType.choices, verbose_name='نوع الحركة')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, verbose_name='المستخدم')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='التاريخ')

    class Meta:
        verbose_name = 'حركة مخزن'
        verbose_name_plural = 'حركات المخزن'

    def __str__(self):
        return f"{self.type} - {self.ingredient.name} ({self.quantity})"

class InventoryMovement(models.Model):
    """Detailed tracking for automatic system inventory deductions and restorations."""
    class MovementType(models.TextChoices):
        DEDUCT = 'deduct', 'خصم'
        RESTORE = 'restore', 'إرجاع'
        
    class Reason(models.TextChoices):
        ORDER_CREATED = 'order_created', 'إنشاء طلب'
        ORDER_UPDATED = 'order_updated', 'تعديل طلب'
        ORDER_DELETED = 'order_deleted', 'حذف من الطلب'
        ORDER_CANCELLED = 'order_cancelled', 'إلغاء الطلب'

    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='system_movements', verbose_name='المكون')
    quantity = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='الكمية')
    movement_type = models.CharField(max_length=20, choices=MovementType.choices, verbose_name='نوع الحركة')
    reason = models.CharField(max_length=50, choices=Reason.choices, verbose_name='السبب')
    order_id = models.PositiveIntegerField(null=True, blank=True, verbose_name='رقم الطلب (معرف)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الحركة')

    class Meta:
        verbose_name = 'حركة مخزون آلية'
        verbose_name_plural = 'حركات المخزون الآلية'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.quantity} {self.ingredient.unit} - {self.get_reason_display()}"


class LowStockAlert(models.Model):
    """Tracks low stock notifications to prevent duplicate alerts."""
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='stock_alerts', verbose_name='المكون')
    is_resolved = models.BooleanField(default=False, verbose_name='تم الحل')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ التنبيه')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الحل')

    class Meta:
        verbose_name = 'تنبيه نقص المخزون'
        verbose_name_plural = 'تنبيهات نقص المخزون'
        ordering = ['-created_at']

    def __str__(self):
        return f"Alert: {self.ingredient.name} (Resolved: {self.is_resolved})"


class WasteLog(models.Model):
    """Logs the waste/spoilage of ingredients."""
    class Reason(models.TextChoices):
        EXPIRED = 'expired', 'منتهي الصلاحية'
        DAMAGED = 'damaged', 'تالف'
        KITCHEN_WASTE = 'kitchen_waste', 'هالك مطبخ'
        INVENTORY_ADJUSTMENT = 'inventory_adjustment', 'تعديل جرد'

    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name='waste_logs', verbose_name='المكون')
    quantity = models.DecimalField(max_digits=10, decimal_places=3, validators=[MinValueValidator(0)], verbose_name='الكمية')
    reason = models.CharField(max_length=50, choices=Reason.choices, verbose_name='سبب الهالك')
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, verbose_name='المستخدم')
    cost_at_time = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='التكلفة وقت التسجيل')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ التسجيل')

    class Meta:
        verbose_name = 'سجل هالك'
        verbose_name_plural = 'سجلات الهادر'
        ordering = ['-created_at']

    def __str__(self):
        return f"Waste: {self.quantity} {self.ingredient.unit} of {self.ingredient.name} ({self.get_reason_display()})"
