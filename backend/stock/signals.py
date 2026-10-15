from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from decimal import Decimal
from orders.models import Order
from .models import StockMovement

@receiver(post_save, sender=Order)
def deduct_stock_on_payment(sender, instance, created, **kwargs):
    """
    Deprecated: Replaced by real-time deductions in orders/signals.py
    """
    pass
