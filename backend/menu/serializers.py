from rest_framework import serializers
from .models import Category, MenuItem, ProductOffer


class ProductOfferSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    discounted_price = serializers.SerializerMethodField()
    is_currently_active = serializers.BooleanField(read_only=True)

    def get_discounted_price(self, obj):
        return obj.discounted_price

    class Meta:
        model = ProductOffer
        fields = [
            'id', 'name', 'product', 'product_name', 'product_price',
            'discount_percentage', 'points_multiplier',
            'start_date', 'end_date', 'is_active',
            'discounted_price', 'is_currently_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        product = data.get('product', getattr(self.instance, 'product', None))
        discount = data.get('discount_percentage', getattr(self.instance, 'discount_percentage', 0))
        
        # Validate product belongs to user's restaurant (if context available)
        request = self.context.get('request')
        if request and hasattr(request.user, 'restaurant') and product:
            from tenants.models import Restaurant
            user_restaurant = request.user.restaurant
            if not request.user.is_superuser:
                # Check if product's category restaurant matches user's restaurant
                if product.category.restaurant != user_restaurant:
                    raise serializers.ValidationError(
                        {"product": "يمكنك فقط إنشاء عروض للمنتجات التابعة لمطعمك"}
                    )
        
        if product and discount is not None:
            # Need to convert discount to Decimal for accurate math since product.price is Decimal
            from decimal import Decimal
            discount_dec = Decimal(str(discount))
            discounted_price = product.price * (Decimal('1') - (discount_dec / Decimal('100')))
            
            if discounted_price < product.production_cost:
                raise serializers.ValidationError(
                    {"discount_percentage": f"نسبة الخصم تجعل السعر ({discounted_price:.2f} ج.م) أقل من تكلفة الإنتاج ({product.production_cost:.2f} ج.م)"}
                )
        return data


class MenuItemSerializer(serializers.ModelSerializer):
    """Serializer for MenuItem."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    active_offer = serializers.SerializerMethodField()

    def get_active_offer(self, obj):
        offer = ProductOffer.get_active_offer_for_item(obj.id)
        if offer:
            return {
                'id': offer.id,
                'name': offer.name,
                'discount_percentage': float(offer.discount_percentage),
                'points_multiplier': float(offer.points_multiplier),
                'discounted_price': float(offer.discounted_price),
                'end_date': offer.end_date.isoformat(),
            }
        return None

    class Meta:
        model = MenuItem
        fields = [
            'id', 'category', 'category_name', 'name', 'name_en',
            'description', 'price', 'production_cost', 'image', 'is_available',
            'preparation_time', 'display_order', 'created_at', 'updated_at',
            'active_offer',
        ]
        read_only_fields = ['id', 'production_cost', 'created_at', 'updated_at']

    def validate(self, data):
        request = self.context.get('request')
        category = data.get('category', getattr(self.instance, 'category', None))

        if request and request.user and request.user.is_authenticated:
            if not request.user.is_superuser:
                user_restaurant_id = getattr(request.user, 'restaurant_id', None)
                if not user_restaurant_id:
                    raise serializers.ValidationError(
                        {"category": "You must be assigned to an active restaurant."}
                    )
                # Verify category belongs to user's restaurant
                if category and category.restaurant_id != user_restaurant_id:
                    raise serializers.ValidationError(
                        {"category": "The selected category does not belong to your restaurant."}
                    )
                # Verify existing instance belongs to user's restaurant
                if self.instance and self.instance.category.restaurant_id != user_restaurant_id:
                    raise serializers.ValidationError(
                        {"category": "You cannot modify menu items belonging to another restaurant."}
                    )
        return data


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category."""
    items = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    def get_items(self, obj):
        qs = obj.items.filter(is_available=True, is_deleted=False)
        # Add restaurant filtering if context is available
        request = self.context.get('request')
        if request and hasattr(request.user, 'restaurant') and not request.user.is_superuser:
            qs = qs.filter(category__restaurant=request.user.restaurant)
        return MenuItemSerializer(qs, many=True, context=self.context).data

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'name_en', 'description', 'image',
            'display_order', 'is_active', 'items', 'items_count',
            'created_at', 'updated_at', 'restaurant'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'restaurant']

    def get_items_count(self, obj):
        qs = obj.items.filter(is_available=True, is_deleted=False)
        # Add restaurant filtering if context is available
        request = self.context.get('request')
        if request and hasattr(request.user, 'restaurant') and not request.user.is_superuser:
            qs = qs.filter(category__restaurant=request.user.restaurant)
        return qs.count()


class CategoryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Category list."""
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'name_en', 'image', 'display_order', 'is_active', 'items_count']

    def get_items_count(self, obj):
        qs = obj.items.filter(is_available=True)
        # Add restaurant filtering if context is available
        request = self.context.get('request')
        if request and hasattr(request.user, 'restaurant') and not request.user.is_superuser:
            qs = qs.filter(category__restaurant=request.user.restaurant)
        return qs.count()
