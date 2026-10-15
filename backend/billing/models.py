from django.db import models
from django.conf import settings
from decimal import Decimal
from orders.models import Order


class Invoice(models.Model):
    """Invoice for an order."""
    
    class PaymentMethod(models.TextChoices):
        CASH = 'cash', 'كاش'
        CARD = 'card', 'فيزا / ماستر كارد'

    order = models.OneToOneField(
        Order, 
        on_delete=models.CASCADE, 
        related_name='invoice',
        verbose_name='الطلب'
    )
    invoice_number = models.CharField(max_length=50, unique=True, verbose_name='رقم الفاتورة')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='المجموع الفرعي')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=14.0, verbose_name='نسبة الضريبة %')
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='قيمة الضريبة')
    service_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='خدمة')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='خصم')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='الإجمالي النهائي')
    payment_method = models.CharField(
        max_length=20, 
        choices=PaymentMethod.choices, 
        default=PaymentMethod.CASH,
        verbose_name='طريقة الدفع'
    )
    is_paid = models.BooleanField(default=False, verbose_name='تم الدفع')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإصدار')

    # Status / Soft Delete / Refund
    is_deleted = models.BooleanField(default=False, verbose_name='محذوف')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الحذف')
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_invoices',
        verbose_name='حذف بواسطة'
    )
    is_refunded = models.BooleanField(default=False, verbose_name='تم الاسترجاع')
    refunded_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الاسترجاع')

    class Meta:
        verbose_name = 'فاتورة'
        verbose_name_plural = 'الفواتير'

    def __str__(self):
        return self.invoice_number

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            import datetime, uuid
            self.invoice_number = f"INV-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        
        self.tax_amount = self.subtotal * (Decimal(str(self.tax_rate)) / Decimal('100'))
        self.total_amount = (self.subtotal + self.tax_amount + self.service_charge) - self.discount_amount
        
        is_new_payment = False
        if self.pk:
            # We use filter().values() to avoid full model instantiation just for one field
            old_is_paid = Invoice.objects.filter(pk=self.pk).values_list('is_paid', flat=True).first()
            if old_is_paid is False and self.is_paid:
                is_new_payment = True
        elif self.is_paid:
            is_new_payment = True

        from django.db import transaction
        with transaction.atomic():
            super().save(*args, **kwargs)
            
            if is_new_payment:
                from orders.models import Order
                order = self.order
                order.status = Order.Status.PAID
                order.save(update_fields=['status'])
                # Trigger loyalty points update
                order.update_customer_loyalty()

class Refund(models.Model):
    """Refund record for a paid invoice."""
    
    invoice = models.OneToOneField(
        Invoice,
        on_delete=models.CASCADE,
        related_name='refund',
        verbose_name='الفاتورة'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='مبلغ الاسترجاع')
    reason = models.TextField(blank=True, verbose_name='سبب الاسترجاع')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='processed_refunds',
        verbose_name='تم الاسترجاع بواسطة'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الاسترجاع')

    class Meta:
        verbose_name = 'استرجاع'
        verbose_name_plural = 'الاسترجاعات'

    def __str__(self):
        return f"Refund for {self.invoice.invoice_number} - {self.amount}"
