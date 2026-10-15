from django.db import models
import uuid
import secrets



class Table(models.Model):
    """Restaurant table."""
    
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'فارغة'
        RESERVED = 'reserved', 'محجوزة'
        OCCUPIED = 'occupied', 'عليها طلب'
    
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tables',
        verbose_name='المطعم'
    )
    number = models.PositiveIntegerField(verbose_name='رقم الترابيزة')
    capacity = models.PositiveIntegerField(default=4, verbose_name='السعة')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
        verbose_name='الحالة'
    )
    # Position for visual layout (drag & drop)
    position_x = models.FloatField(default=0, verbose_name='الموقع X')
    position_y = models.FloatField(default=0, verbose_name='الموقع Y')
    floor = models.PositiveIntegerField(default=1, verbose_name='الطابق')
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'ترابيزة'
        verbose_name_plural = 'الترابيزات'
        ordering = ['floor', 'number']
        unique_together = ('restaurant', 'number')

    def __str__(self):
        return f"ترابيزة {self.number} ({self.get_status_display()})"


class Reservation(models.Model):
    """Table reservation."""
    
    table = models.ForeignKey(
        Table, 
        on_delete=models.CASCADE, 
        related_name='reservations',
        verbose_name='الترابيزة'
    )
    customer_name = models.CharField(max_length=200, verbose_name='اسم العميل')
    customer_phone = models.CharField(max_length=20, verbose_name='رقم الهاتف')
    guests_count = models.PositiveIntegerField(default=2, verbose_name='عدد الضيوف')
    reservation_time = models.DateTimeField(verbose_name='وقت الحجز')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    is_confirmed = models.BooleanField(default=False, verbose_name='مؤكد')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'حجز'
        verbose_name_plural = 'الحجوزات'
        ordering = ['-reservation_time']

    def __str__(self):
        return f"حجز {self.customer_name} - ترابيزة {self.table.number}"


class QRCode(models.Model):
    """QR Code metadata for a table."""
    table = models.OneToOneField(Table, on_delete=models.CASCADE, related_name='qr_code', verbose_name='الترابيزة')
    code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, verbose_name='كود الـ QR')
    is_active = models.BooleanField(default=True, verbose_name='نشط')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'كود QR'
        verbose_name_plural = 'أكواد QR'

    def __str__(self):
        return f"QR الترابيزة {self.table.number}"


class TableSession(models.Model):
    """Active session for a customer group at a table."""
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='sessions', verbose_name='الترابيزة')
    session_token = models.CharField(max_length=64, unique=True, verbose_name='توكن الجلسة')
    start_time = models.DateTimeField(auto_now_add=True, verbose_name='وقت البدء')
    end_time = models.DateTimeField(null=True, blank=True, verbose_name='وقت الانتهاء')
    is_active = models.BooleanField(default=True, verbose_name='نشطة')

    class Meta:
        verbose_name = 'جلسة طاولة'
        verbose_name_plural = 'جلسات الطاولات'
        ordering = ['-start_time']

    def save(self, *args, **kwargs):
        if not self.session_token:
            self.session_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"جلسة ترابيزة {self.table.number} - {self.start_time.strftime('%Y-%m-%d %H:%M')}"
