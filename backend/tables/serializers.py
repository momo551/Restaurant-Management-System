from rest_framework import serializers
from .models import Table, Reservation, QRCode, TableSession


class QRCodeSerializer(serializers.ModelSerializer):
    table_number = serializers.IntegerField(source='table.number', read_only=True)
    
    class Meta:
        model = QRCode
        fields = ['id', 'table', 'table_number', 'code', 'is_active', 'created_at']


class TableSerializer(serializers.ModelSerializer):
    """Serializer for Table."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    current_order = serializers.SerializerMethodField()
    qr_code = QRCodeSerializer(read_only=True)
    
    class Meta:
        model = Table
        fields = [
            'id', 'number', 'capacity', 'status', 'status_display',
            'position_x', 'position_y', 'floor', 'is_active', 'notes',
            'current_order', 'qr_code', 'created_at', 'updated_at', 'restaurant'
        ]
        read_only_fields = ['id', 'qr_code', 'created_at', 'updated_at', 'restaurant']

    def get_current_order(self, obj):
        from orders.models import Order
        order = Order.objects.filter(
            table=obj,
            status__in=['pending', 'confirmed', 'in_kitchen', 'ready']
        ).first()
        if order:
            return {'id': order.id, 'status': order.status, 'total': str(order.total)}
        return None


class ReservationSerializer(serializers.ModelSerializer):
    """Serializer for Reservation."""
    table_number = serializers.IntegerField(source='table.number', read_only=True)
    
    class Meta:
        model = Reservation
        fields = [
            'id', 'table', 'table_number', 'customer_name', 'customer_phone',
            'guests_count', 'reservation_time', 'notes', 'is_confirmed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']




class TableSessionSerializer(serializers.ModelSerializer):
    table_number = serializers.IntegerField(source='table.number', read_only=True)
    restaurant_slug = serializers.CharField(source='table.restaurant.slug', read_only=True)
    
    class Meta:
        model = TableSession
        fields = ['id', 'table', 'table_number', 'session_token', 'start_time', 'end_time', 'is_active', 'restaurant_slug']
        read_only_fields = ['id', 'session_token', 'start_time']
