from rest_framework import serializers
from .models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'order', 'invoice_number', 'subtotal', 'tax_rate',
            'tax_amount', 'service_charge', 'discount_amount',
            'total_amount', 'payment_method', 'is_paid', 'created_at',
            'is_deleted', 'deleted_at', 'deleted_by', 'is_refunded', 'refunded_at'
        ]
        read_only_fields = ['invoice_number', 'tax_amount', 'total_amount', 'order']
