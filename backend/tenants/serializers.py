from rest_framework import serializers
from .models import Restaurant


class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = [
            'id',
            'uuid',
            'name',
            'slug',
            'phone',
            'address',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'uuid', 'created_at', 'updated_at']


class RestaurantSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ['id', 'uuid', 'name', 'slug', 'is_active']
        read_only_fields = ['id', 'uuid', 'name', 'slug', 'is_active']
