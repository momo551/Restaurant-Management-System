from rest_framework import serializers
from .models import Customer, LoyaltyPoint, Coupon, Campaign

class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'multiplier', 'start_date', 'end_date',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'restaurant']

class LoyaltyPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyPoint
        fields = [
            'id', 'customer', 'points', 'transaction_type',
            'order', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class CouponSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'discount_amount',
            'min_purchase', 'is_active', 'valid_until',
            'customer', 'customer_name', 'used_at', 'created_at', 'restaurant'
        ]
        read_only_fields = ['id', 'restaurant']

class CustomerSerializer(serializers.ModelSerializer):
    loyalty_points = LoyaltyPointSerializer(many=True, read_only=True)
    coupons = CouponSerializer(many=True, read_only=True)
    visits = serializers.SerializerMethodField()

    def get_visits(self, obj):
        # If visits is annotated in queryset, use it
        if hasattr(obj, 'visits'):
            return obj.visits
        # Otherwise count orders
        return obj.orders.count()


    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'points_balance', 
            'total_spent', 'last_visit', 'created_at', 
            'loyalty_points', 'coupons', 'visits', 'restaurant'
        ]
        read_only_fields = ['id', 'points_balance', 'total_spent', 'last_visit', 'created_at', 'restaurant']


class PublicCustomerInfoSerializer(serializers.ModelSerializer):
    """Minimal customer information for public lookup - reduces exposure."""
    
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone']
        read_only_fields = ['id', 'name', 'phone']
