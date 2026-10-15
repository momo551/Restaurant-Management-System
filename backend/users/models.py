from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom User model with roles for restaurant management."""
    
    class Role(models.TextChoices):
        OWNER = 'owner', 'مالك المطعم'
        MANAGER = 'manager', 'مدير'
        INVENTORY_MANAGER = 'inventory_manager', 'مدير مخازن'
        CASHIER = 'cashier', 'كاشير'
        KITCHEN = 'kitchen', 'مطبخ'
        DELIVERY = 'delivery', 'طيار / مندوب'
        HALL_MANAGER = 'hall_manager', 'مدير صاله'
        HALL_CAPTAIN = 'hall_captain', 'كابتن صاله'
        HR = 'hr', 'موارد بشرية'
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CASHIER,
        verbose_name='الدور'
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name='رقم الهاتف')
    monthly_target = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='المستهدف الشهري')
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='الراتب الأساسي')
    delivery_commission_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='عمولة التوصيل')
    total_commissions = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='إجمالي العمولات المتراكمة')
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
        verbose_name='المطعم'
    )
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'مستخدم'
        verbose_name_plural = 'المستخدمين'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER

    @property
    def is_manager(self):
        return self.role == self.Role.MANAGER

    @property
    def is_cashier(self):
        return self.role == self.Role.CASHIER

    @property
    def is_kitchen(self):
        return self.role == self.Role.KITCHEN

    @property
    def is_delivery(self):
        return self.role == self.Role.DELIVERY

    @property
    def is_hall_manager(self):
        return self.role == self.Role.HALL_MANAGER

    @property
    def is_hall_captain(self):
        return self.role == self.Role.HALL_CAPTAIN

    @property
    def is_inventory_manager(self):
        return self.role == self.Role.INVENTORY_MANAGER

    @property
    def is_hr(self):
        return self.role == self.Role.HR


class ActivityLog(models.Model):
    """Activity log for auditing user actions."""
    
    class ActionType(models.TextChoices):
        CREATE = 'create', 'إنشاء'
        UPDATE = 'update', 'تعديل'
        DELETE = 'delete', 'حذف'
        LOGIN = 'login', 'تسجيل دخول'
        LOGOUT = 'logout', 'تسجيل خروج'
        ORDER_CREATE = 'order_create', 'إنشاء طلب'
        ORDER_UPDATE = 'order_update', 'تعديل طلب'
        ORDER_DELETE = 'order_delete', 'حذف طلب'
        PAYMENT = 'payment', 'دفع'
        PRICE_CHANGE = 'price_change', 'تغيير سعر'
        DISCOUNT_CHANGE = 'discount_change', 'تغيير خصم'
    
    user = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='activity_logs',
        verbose_name='المستخدم'
    )
    action = models.CharField(
        max_length=20,
        choices=ActionType.choices,
        verbose_name='الإجراء'
    )
    model_name = models.CharField(max_length=100, blank=True, verbose_name='اسم النموذج')
    object_id = models.PositiveIntegerField(null=True, blank=True, verbose_name='معرف الكائن')
    description = models.TextField(blank=True, verbose_name='الوصف')
    old_data = models.JSONField(null=True, blank=True, verbose_name='بيانات قبل التعديل')
    new_data = models.JSONField(null=True, blank=True, verbose_name='بيانات بعد التعديل')
    extra_data = models.JSONField(null=True, blank=True, verbose_name='بيانات إضافية')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='عنوان IP')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='التاريخ')

    class Meta:
        verbose_name = 'سجل النشاط'
        verbose_name_plural = 'سجلات النشاط'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.get_action_display()} - {self.created_at}"

class ModulePermission(models.Model):
    """Dynamic permission mapping for roles and modules per restaurant."""
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='module_permissions',
        verbose_name='المطعم'
    )
    role = models.CharField(
        max_length=20,
        choices=User.Role.choices,
        verbose_name='الدور'
    )
    module_key = models.CharField(max_length=50, verbose_name='مفتاح الوحدة')
    module_label = models.CharField(max_length=100, verbose_name='اسم الوحدة')
    allowed = models.BooleanField(default=False, verbose_name='مسموح')

    class Meta:
        verbose_name = 'صلاحية الوحدة'
        verbose_name_plural = 'صلاحيات الوحدات'
        unique_together = ('restaurant', 'role', 'module_key')

    def __str__(self):
        return f"{self.get_role_display()} - {self.module_label} ({'مسموح' if self.allowed else 'ممنوع'})"
