from django.db import models

class DailyClosingReport(models.Model):
    """Stores the end-of-day summary of sales and financials."""
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='daily_closing_reports',
        verbose_name='المطعم'
    )
    date = models.DateField(verbose_name='تاريخ الوردية')
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='إجمالي المبيعات')
    total_orders = models.PositiveIntegerField(default=0, verbose_name='إجمالي الطلبات')
    cash_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='إجمالي النقدي')
    card_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='إجمالي الإلكتروني')
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='إجمالي الخصومات')
    average_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='متوسط قيمة الطلب')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')

    class Meta:
        verbose_name = 'تقرير يومي لتقفيل الوردية'
        verbose_name_plural = 'التقارير اليومية لتقفيل الوردية'
        ordering = ['-date']
        unique_together = ('restaurant', 'date')

    def __str__(self):
        return f"تقفيل يوم {self.date}"
