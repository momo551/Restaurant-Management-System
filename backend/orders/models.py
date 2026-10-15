from django.db import models
from django.conf import settings
from decimal import Decimal
from menu.models import MenuItem
from tables.models import Table


class Order(models.Model):
    """Order model representing a customer order."""
    
    class OrderType(models.TextChoices):
        DINE_IN = 'dine_in', 'صالة'
        TAKEAWAY = 'takeaway', 'تيك اوي'
        DELIVERY = 'delivery', 'دليفرى'

    class Status(models.TextChoices):
        PENDING = 'pending', 'قيد الانتظار'
        CONFIRMED = 'confirmed', 'مؤكد'
        IN_KITCHEN = 'in_kitchen', 'في المطبخ'
        READY = 'ready', 'جاهز'
        SERVED = 'served', 'تم التقديم'
        PAID = 'paid', 'تم الدفع'
        OUT_FOR_DELIVERY = 'out_for_delivery', 'خرج للتوصيل'
        DELIVERED = 'delivered', 'تم التوصيل'
        CANCELLED = 'cancelled', 'ملغي'

    class DeliveryStatus(models.TextChoices):
        PENDING = 'pending', 'قيد الانتظار'
        PREPARING = 'preparing', 'جاري التحضير'
        OUT_FOR_DELIVERY = 'out_for_delivery', 'خرج للتوصيل'
        DELIVERED = 'delivered', 'تم التوصيل'
        CANCELLED = 'cancelled', 'ملغي'

    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='المطعم'
    )
    order_number = models.CharField(max_length=20, verbose_name='رقم الطلب')
    daily_id = models.PositiveIntegerField(default=1, verbose_name='الرقم التسلسلي اليومي')
    order_type = models.CharField(
        max_length=20, 
        choices=OrderType.choices, 
        default=OrderType.DINE_IN,
        verbose_name='نوع الطلب'
    )
    table = models.ForeignKey(
        Table, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='orders',
        verbose_name='الترابيزة'
    )
    table_session = models.ForeignKey(
        'tables.TableSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='جلسة الطاولة'
    )
    customer = models.ForeignKey(
        'loyalty.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='العميل'
    )
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.IN_KITCHEN,
        verbose_name='الحالة'
    )
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='الإجمالي')
    notes = models.TextField(blank=True, verbose_name='ملاحظات')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='created_orders',
        verbose_name='أنشئ بواسطة'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')
    prep_time = models.PositiveIntegerField(default=15, verbose_name='وقت التحضير (دقائق)')
    estimated_ready_at = models.DateTimeField(null=True, blank=True, verbose_name='الوقت المتوقع للجهازية')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='الإجمالي الفرعي')

    # Soft Delete Fields
    is_deleted = models.BooleanField(default=False, verbose_name='محذوف')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ الحذف')
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_orders',
        verbose_name='حذف بواسطة'
    )
    is_edited = models.BooleanField(default=False, verbose_name='تم التعديل')


    # Delivery-specific fields
    customer_name = models.CharField(max_length=100, blank=True, verbose_name='اسم العميل')
    customer_phone = models.CharField(max_length=20, blank=True, verbose_name='رقم تليفون العميل')
    delivery_address = models.TextField(blank=True, verbose_name='عنوان التوصيل')
    delivery_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delivery_orders',
        verbose_name='المندوب'
    )
    delivery_agent_name = models.CharField(max_length=100, blank=True, verbose_name='اسم المندوب')
    delivery_status = models.CharField(
        max_length=20,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
        verbose_name='حالة التوصيل'
    )
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='رسوم التوصيل')
    delivery_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='عمولة المندوب')
    net_revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='صافي الربح للمطعم')
    amount_payable_to_driver = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='المبلغ المستحق للمندوب')
    commission_accumulated = models.BooleanField(default=False, verbose_name='تم إضافة العمولة للموازنة')
    estimated_delivery_at = models.DateTimeField(null=True, blank=True, verbose_name='الوقت المتوقع للتوصيل')
    
    # Pricing and Discounts
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='نسبة الخصم %')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='قيمة الخصم')
    
    stock_deducted = models.BooleanField(default=False, verbose_name='تم خصم المخزون')
    loyalty_points_earned = models.PositiveIntegerField(default=0, verbose_name='نقاط الولاء المحتسبة')
    used_points = models.PositiveIntegerField(default=0, verbose_name='نقاط الولاء المستخدمة')
    loyalty_processed = models.BooleanField(default=False, verbose_name='تمت معالجة الولاء')

    coupon = models.ForeignKey(
        'loyalty.Coupon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name='الكوبون المستخدم'
    )

    class Meta:
        verbose_name = 'طلب'
        verbose_name_plural = 'الطلبات'
        ordering = ['-created_at']
        unique_together = ('restaurant', 'order_number')

    def save(self, *args, **kwargs):
        from django.utils import timezone
        from datetime import timedelta
        
        if not self.id and not self.estimated_ready_at:
            # If it's a new order and estimated_ready_at isn't set
            self.estimated_ready_at = timezone.now() + timedelta(minutes=self.prep_time)

        if not self.id and self.order_type == self.OrderType.DELIVERY and not self.estimated_delivery_at:
            # Default estimated delivery = order time + 45 minutes
            self.estimated_delivery_at = timezone.now() + timedelta(minutes=45)
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Order {self.order_number} - {self.get_status_display()}"

    def calculate_loyalty_points(self):
        """Calculate points based on items total (excluding delivery fee) and active campaigns."""
        # Basis for points is total minus delivery fee (i.e., items after discounts)
        points_basis = self.total - self.delivery_fee
        
        if points_basis > 0:
            from loyalty.models import Campaign
            # Base points logic (1 EGP = 1 Point as per current implementation, 
            # though comment says 10 EGP = 1 Point, the code uses int(self.total))
            # Note: The existing code was int(self.total), which means 1 EGP = 1 Point.
            # I will maintain the 1:1 ratio if it was already there, or follow the comment if preferred.
            # Looking at line 172: base_points = int(self.total) -> this is 1 point per 1 EGP.
            base_points = int(points_basis)

            
            # Apply campaign multiplier if any
            active_campaign = Campaign.get_active_campaign(restaurant=self.restaurant)
            multiplier = active_campaign.multiplier if active_campaign else 1.0
            
            self.loyalty_points_earned = int(base_points * float(multiplier))
            self.save(update_fields=['loyalty_points_earned'])

    def update_customer_loyalty(self):
        """Update customer balance and total spent when order reaches terminal state."""
        if self.customer and not self.loyalty_processed:
            # Terminal states that trigger point credit
            TERMINAL_STATES = [self.Status.SERVED, self.Status.DELIVERED, self.Status.PAID]
            
            if self.status in TERMINAL_STATES:
                from loyalty.models import LoyaltyPoint
                
                # Update customer totals
                self.customer.points_balance += self.loyalty_points_earned
                # Deduct used points
                if self.used_points > 0:
                    self.customer.points_balance -= self.used_points
                
                # Ensure balance doesn't go below 0
                if self.customer.points_balance < 0:
                    self.customer.points_balance = 0

                self.customer.total_spent += self.total
                self.customer.save()
                
                # Record the earned transaction
                if self.loyalty_points_earned > 0:
                    LoyaltyPoint.objects.create(
                        customer=self.customer,
                        points=self.loyalty_points_earned,
                        transaction_type=LoyaltyPoint.TransactionType.EARNED,
                        order=self,
                        description=f"نقاط مكتسبة من طلب رقم {self.order_number}"
                    )
                
                # Record the redeemed transaction
                if self.used_points > 0:
                    LoyaltyPoint.objects.create(
                        customer=self.customer,
                        points=-self.used_points,
                        transaction_type=LoyaltyPoint.TransactionType.REDEEMED,
                        order=self,
                        description=f"نقاط مستبدلة لخصم فاتورة طلب رقم {self.order_number}"
                    )
                
                self.loyalty_processed = True
                self.save(update_fields=['loyalty_processed'])
            


    def update_total(self):
        """Update order total and financial distribution, including loyalty and coupons."""
        items_total = sum(item.subtotal for item in self.items.all())
        self.subtotal = items_total
        
        # Calculate production cost for validation
        total_production_cost = sum(item.menu_item.production_cost * item.quantity for item in self.items.all())
        
        # 1. Start with Percentage Discount
        total_discount = (self.subtotal * (self.discount_percentage / Decimal('100'))).quantize(Decimal('0.01'))
        
        # 2. Add Coupon Discount
        if self.coupon:
            if self.coupon.discount_type == self.coupon.DiscountType.PERCENTAGE:
                coupon_discount = (self.subtotal * (self.coupon.discount_amount / Decimal('100'))).quantize(Decimal('0.01'))
            else:
                coupon_discount = self.coupon.discount_amount
            total_discount += coupon_discount
            
        # 3. Add Loyalty Points Discount (10 points = 1 EGP)
        if self.used_points > 0:
            points_discount = Decimal(self.used_points) / Decimal('10')
            total_discount += points_discount

        # Apply final discount (cannot exceed subtotal)
        self.discount_amount = min(total_discount, self.subtotal)
        
        # Validation: Price after discount must not be less than production cost (optional safety)
        # if total_production_cost > 0 and (self.subtotal - self.discount_amount) < total_production_cost:
        #    pass # We'll allow it for loyalty redemptions as those are "pre-paid" in a sense
        
        final_billable = self.subtotal - self.discount_amount


        if self.order_type == self.OrderType.DELIVERY:
            # 1. Dynamic Delivery Fee Rules
            if items_total < 500:
                self.delivery_fee = Decimal('25.00')
            elif items_total < 1000:
                self.delivery_fee = Decimal('28.00')
            elif items_total < 2000:
                self.delivery_fee = Decimal('33.00')
            elif items_total < 5000:
                self.delivery_fee = Decimal('48.00')
            elif items_total < 8000:
                self.delivery_fee = Decimal('98.00')
            else:
                self.delivery_fee = Decimal('259.00')

            # 2. Commission Rule (15% of subtotal)
            self.delivery_commission = items_total * Decimal('0.15')

            # 3. Final amount paid by customer
            self.total = final_billable + self.delivery_fee

            # 4. Net revenue for the restaurant
            self.net_revenue = final_billable - self.delivery_commission

            # 5. Amount payable to the driver
            self.amount_payable_to_driver = self.delivery_commission + self.delivery_fee
        else:
            self.delivery_fee = 0
            self.delivery_commission = 0
            self.total = final_billable
            self.net_revenue = final_billable
            self.amount_payable_to_driver = 0
            
        self.save()


class OrderItem(models.Model):
    """Individual item within an order."""
    
    order = models.ForeignKey(
        Order, 
        on_delete=models.CASCADE, 
        related_name='items',
        verbose_name='الطلب'
    )
    menu_item = models.ForeignKey(
        MenuItem, 
        on_delete=models.PROTECT,
        verbose_name='الصنف'
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name='الكمية')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='سعر الوحدة')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='الإجمالي الفرعي')
    notes = models.CharField(max_length=255, blank=True, verbose_name='ملاحظات (مثلاً بدون بصل)')
    
    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = 'صنف طلب'
        verbose_name_plural = 'أصناف الطلب'

    def __str__(self):
        return f"{self.quantity} x {self.menu_item.name}"

class OrderAuditLog(models.Model):
    """Audit log for tracking modifications and deletions of orders."""
    
    class ActionType(models.TextChoices):
        EDIT = 'edit', 'تعديل'
        DELETE = 'delete', 'حذف'
        
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name='الطلب'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_audit_logs',
        verbose_name='المستخدم'
    )
    action = models.CharField(
        max_length=20,
        choices=ActionType.choices,
        verbose_name='الإجراء'
    )
    data_before = models.JSONField(null=True, blank=True, verbose_name='البيانات قبل التعديل')
    data_after = models.JSONField(null=True, blank=True, verbose_name='البيانات بعد التعديل')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإجراء')
    
    class Meta:
        verbose_name = 'سجل تعديل طلب'
        verbose_name_plural = 'سجلات تعديل الطلبات'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_action_display()} - Order {self.order.order_number} by {self.user}"


class DailyOrderSequence(models.Model):
    """
    Tenant-scoped atomic daily order sequence counter.
    Guarantees concurrency-safe sequential daily_id generation per restaurant per day.
    """
    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        related_name='daily_order_sequences',
        verbose_name='المطعم'
    )
    date = models.DateField(verbose_name='التاريخ')
    last_daily_id = models.PositiveIntegerField(default=0, verbose_name='آخر رقم تسلسلي')

    class Meta:
        verbose_name = 'تسلسل الطلبات اليومي'
        verbose_name_plural = 'تسلسلات الطلبات اليومية'
        unique_together = ('restaurant', 'date')
        indexes = [
            models.Index(fields=['restaurant', 'date']),
        ]

    def __str__(self):
        return f"{self.restaurant_id} - {self.date}: {self.last_daily_id}"

    @classmethod
    def get_next_daily_id(cls, restaurant, date=None):
        """
        Atomically acquires a row lock on the sequence record for (restaurant, date)
        and increments last_daily_id. Safe to call from any context.
        """
        from django.utils import timezone
        from django.db import transaction, IntegrityError

        if date is None:
            date = timezone.localdate()

        with transaction.atomic():
            # Try to select for update first
            seq = cls.objects.filter(restaurant=restaurant, date=date).select_for_update().first()
            if not seq:
                # Create if doesn't exist, safely handling concurrent creation
                try:
                    with transaction.atomic():
                        cls.objects.create(restaurant=restaurant, date=date, last_daily_id=0)
                except IntegrityError:
                    # Another concurrent worker created the row simultaneously
                    pass
                seq = cls.objects.filter(restaurant=restaurant, date=date).select_for_update().first()

            # If last_daily_id is 0, check if there are pre-existing orders for today (e.g. initial backfill)
            if seq.last_daily_id == 0:
                max_order = Order.objects.filter(restaurant=restaurant, created_at__date=date).order_by('-daily_id').first()
                if max_order and max_order.daily_id > seq.last_daily_id:
                    seq.last_daily_id = max_order.daily_id

            seq.last_daily_id += 1
            seq.save(update_fields=['last_daily_id'])
            return seq.last_daily_id


