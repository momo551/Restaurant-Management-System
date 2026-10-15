from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Table, QRCode

@receiver(post_save, sender=Table)
def create_table_qr(sender, instance, created, **kwargs):
    if created:
        QRCode.objects.create(table=instance)
