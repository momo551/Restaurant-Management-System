import datetime
from decimal import Decimal

from rest_framework import serializers

from django.db import transaction
from .models import Order, OrderItem, OrderAuditLog, DailyOrderSequence
from .validators import parse_discount_percentage
from menu.models import MenuItem
from menu.serializers import MenuItemSerializer
from django.utils import timezone
from stock.utils import validate_stock_availability
from loyalty.models import Customer, Coupon

class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_details = MenuItemSerializer(source='menu_item', read_only=True)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'menu_item', 'menu_item_details', 'quantity', 
            'unit_price', 'subtotal', 'notes'
        ]
        extra_kwargs = {
            'unit_price': {'required': False},
            'subtotal': {'required': False},
        }

class OrderSerializer(serializers.ModelSerializer):

    items = OrderItemSerializer(many=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    table_number = serializers.IntegerField(source='table.number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    delivery_status_display = serializers.CharField(source='get_delivery_status_display', read_only=True)
    waiting_time = serializers.SerializerMethodField()
    priority_level = serializers.SerializerMethodField()
    coupon_code = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True)
    coupon_details = serializers.SerializerMethodField()
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'daily_id', 'order_type', 'order_type_display',
            'table', 'table_number', 'status', 'status_display',
            'total', 'subtotal', 'notes', 'items', 'customer', 'created_by', 'created_by_name',
            'restaurant', 'restaurant_name',
            'created_at', 'updated_at', 'prep_time', 'estimated_ready_at', 'is_edited',
            'waiting_time', 'priority_level',
            'discount_percentage', 'discount_amount',
            'customer_name', 'customer_phone', 'delivery_address',
            'delivery_agent', 'delivery_agent_name',
            'delivery_status', 'delivery_status_display',
            'delivery_fee', 'delivery_commission', 'net_revenue', 'amount_payable_to_driver',
            'estimated_delivery_at', 'loyalty_points_earned', 'used_points', 'coupon', 'coupon_code', 'coupon_details'
        ]
        read_only_fields = ['order_number', 'total', 'created_by', 'created_at', 'loyalty_points_earned', 'coupon', 'restaurant']


    def get_coupon_details(self, obj):
        return obj.coupon.code if obj.coupon else None

    def get_waiting_time(self, obj):
        """Returns minutes elapsed since order creation."""
        if obj.status in [Order.Status.PAID, Order.Status.CANCELLED, Order.Status.DELIVERED]:
            return 0
        diff = timezone.now() - obj.created_at
        return int(diff.total_seconds() / 60)

    def get_priority_level(self, obj):
        """Calculates priority based on waiting time."""
        minutes = self.get_waiting_time(obj)
        if minutes > 30:
            return 'URGENT'
        if minutes > 15:
            return 'HIGH'
        return 'NORMAL'

    def _resolve_restaurant(self):
        """
        Return the trusted tenant for this write, or ``None``.

        The request body is never consulted: ``restaurant`` is read-only on this
        serializer. Each entry point already owns the authoritative context:
          * updating an order  -> the tenant the order is already bound to;
          * public website     -> the tenant resolved by the view from the URL slug;
          * QR / table session -> the tenant of the table session (QR bypasses this
                                  serializer and validates the session itself);
          * staff / POS        -> the tenant of the authenticated user.
        """
        if isinstance(self.instance, Order):
            return self.instance.restaurant

        restaurant = self.context.get('restaurant')
        if restaurant is not None:
            return restaurant

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is not None and getattr(user, 'is_authenticated', False):
            return getattr(user, 'restaurant', None)
        return None

    @staticmethod
    def _foreign_menu_items(items, restaurant):
        """Return resolved menu items in ``items`` that belong to another tenant."""
        if not items or restaurant is None:
            return []
        foreign = []
        for item in items:
            menu_item = item.get('menu_item')
            if not isinstance(menu_item, MenuItem):
                # Unresolved ids are resolved (and rejected) by the stock validator.
                continue
            category = getattr(menu_item, 'category', None)
            if category is None or category.restaurant_id != restaurant.id:
                foreign.append(menu_item)
        return foreign

    def validate(self, data):
        """Ensure status and loyalty logic is valid."""
        errors = {}
        
        # Check if updating an existing order
        if self.instance:
            if not isinstance(self.instance, Order):
                # If instance is a queryset (many=True), skip validation
                return data
            
            # Prevent changing status of served/delivered/cancelled orders
            if self.instance.status in [Order.Status.SERVED, Order.Status.DELIVERED, Order.Status.CANCELLED]:
                if 'status' in data and data['status'] != self.instance.status:
                     raise serializers.ValidationError({"status": "لا يمكن تغيير حالة الطلب بعد تقديمه أو إلغائه."})
        
        # Mandatory fields for new orders
        if not self.instance:
            is_public = self.context.get('public_order', False)
            if is_public:
                # Security hardening: public orders must never dictate privileged status,
                # manual discounts, or delivery/financial internals.
                data['status'] = Order.Status.PENDING
                data['discount_percentage'] = Decimal('0.00')
                data['discount_amount'] = Decimal('0.00')
                data['delivery_agent'] = None
                data['delivery_commission'] = Decimal('0.00')
                data['net_revenue'] = Decimal('0.00')
                data['amount_payable_to_driver'] = Decimal('0.00')
                data['is_edited'] = False

            if not data.get('customer_name'):
                errors["customer_name"] = "اسم العميل مطلوب."
            if not data.get('customer_phone'):
                errors["customer_phone"] = "رقم تليفون العميل مطلوب."

        # Unified discount policy (shared with the POS edit endpoint): 0..100%,
        # at most two decimals, rejected when NaN/Infinity/boolean/non numeric.
        # Public orders were already forced to Decimal('0.00') above, so a client
        # supplied discount can never survive on that path.
        if 'discount_percentage' in data:
            try:
                data['discount_percentage'] = parse_discount_percentage(
                    data['discount_percentage']
                )
            except ValueError as exc:
                errors["discount_percentage"] = str(exc)

        # Loyalty & Coupon logic
        customer = data.get('customer') or (self.instance.customer if self.instance else None)

        # Trusted tenant for this write (never the request payload).
        restaurant = self._resolve_restaurant()

        # An order must never be created without a tenant, and no validation may
        # silently fall back to a global (cross-tenant) query.
        if not self.instance and restaurant is None:
            errors["restaurant"] = "لا يمكن إنشاء طلب بدون سياق مطعم."

        # Every product must belong to the restaurant the order is saved for.
        foreign_items = self._foreign_menu_items(data.get('items'), restaurant)
        if foreign_items:
            errors["items"] = (
                "الأصناف التالية لا تنتمي إلى هذا المطعم: "
                + ", ".join(str(item.id) for item in foreign_items)
            )
        
        # Auto-resolve customer by phone if not provided
        if not customer and data.get('customer_phone'):
            if restaurant:
                customer = Customer.objects.filter(restaurant=restaurant, phone=data.get('customer_phone')).first()
            # If no restaurant context, do not perform global customer lookup
            if customer:
                data['customer'] = customer

        # Validate used points balance
        used_points_raw = data.get('used_points') or self.initial_data.get('use_points', 0)
        try:
            used_points = int(used_points_raw)
        except (ValueError, TypeError):
            used_points = 0

        if used_points > 0:
            data['used_points'] = used_points

            if not customer:

                errors["used_points"] = "يجب تحديد عميل لاستخدام النقاط."
            elif used_points > customer.points_balance:
                errors["used_points"] = f"رصيد النقاط غير كافٍ. الرصيد الحالي: {customer.points_balance}"
        
        # Validate coupon code (strictly inside the order's tenant)
        coupon_code = data.get('coupon_code')
        if coupon_code:
            now = timezone.now()
            if restaurant is None:
                errors["coupon_code"] = "لا يمكن التحقق من الكوبون بدون سياق مطعم."
            else:
                coupon = Coupon.objects.filter(restaurant=restaurant, code=coupon_code.upper(), is_active=True, valid_until__gte=now).first()
                if not coupon:
                    errors["coupon_code"] = "كوبون غير صالح أو انتهت صلاحيته."
                elif coupon.used_at:
                    errors["coupon_code"] = "هذا الكوبون تم استخدامه مسبقاً."
                elif coupon.customer and coupon.customer != customer:
                    errors["coupon_code"] = "هذا الكوبون مخصص لعميل آخر."
                else:
                    data['coupon'] = coupon

        # Table validation for dine-in
        if data.get('order_type') == Order.OrderType.DINE_IN:
            if not data.get('table') and not data.get('table_session'):
                if not self.instance:
                    errors["order_type"] = "طلبات الصالة يجب أن تكون مرتبطة بطاولة أو جلسة."
        
        if errors:
            raise serializers.ValidationError(errors)

        if 'items' in data:
            # Tenant-scoped stock validation only: a global check would mix tenants.
            if restaurant is None:
                raise serializers.ValidationError({
                    "restaurant": "لا يمكن التحقق من المخزون بدون سياق مطعم."
                })
            validate_stock_availability(data['items'], self.instance, restaurant)
            
        return data

    def create(self, validated_data):
        with transaction.atomic():
            items_data = validated_data.pop('items')

            # Get restaurant context for tenant-scoped sequence generation
            restaurant = validated_data.get('restaurant')

            if restaurant is None:
                # Orders without restaurant context should fail safely
                raise serializers.ValidationError({"restaurant": "Restaurant context is required for order creation"})

            # Defence in depth (validate() already enforces this): never persist a
            # discount outside the shared policy, even when create() is reached
            # without validate(). Runs before the daily sequence is consumed.
            if 'discount_percentage' in validated_data:
                try:
                    validated_data['discount_percentage'] = parse_discount_percentage(
                        validated_data['discount_percentage']
                    )
                except ValueError as exc:
                    raise serializers.ValidationError({
                        "discount_percentage": str(exc)
                    })

            # Defence in depth (validate() already enforces this): never persist a
            # line item that belongs to a different restaurant.
            foreign_items = self._foreign_menu_items(items_data, restaurant)
            if foreign_items:
                raise serializers.ValidationError({
                    "items": "بعض الأصناف المطلوبة لا تنتمي إلى هذا المطعم."
                })

            # Sequence generation - tenant-scoped & concurrency-safe
            today = timezone.localdate()
            daily_id = DailyOrderSequence.get_next_daily_id(restaurant=restaurant, date=today)
            date_str = today.strftime('%Y%m%d')
            order_number = f"ORD-{date_str}-{daily_id:03d}"
            
            # Remove helper field before creation
            validated_data.pop('coupon_code', None)

            order = Order.objects.create(
                order_number=order_number, 
                daily_id=daily_id,
                **validated_data
            )
            
            if order.coupon:
                order.coupon.used_at = timezone.now()
                order.coupon.save()

            is_public = self.context.get('public_order', False)
            if is_public:
                # Force server-controlled values on persisted order
                order.status = Order.Status.PENDING
                order.discount_percentage = Decimal('0.00')
                order.delivery_agent = None
                order.delivery_commission = Decimal('0.00')
                order.net_revenue = Decimal('0.00')
                order.amount_payable_to_driver = Decimal('0.00')
                order.is_edited = False
                order.save(update_fields=[
                    'status', 'discount_percentage', 'delivery_agent',
                    'delivery_commission', 'net_revenue', 'amount_payable_to_driver',
                    'is_edited'
                ])

            for item_data in items_data:
                menu_item = item_data['menu_item']
                # For public orders, unit price must always be server-derived (never client-supplied)
                if is_public or 'unit_price' not in item_data:
                    from menu.models import ProductOffer
                    active_offer = ProductOffer.get_active_offer_for_item(menu_item.id)
                    if active_offer:
                        item_data['unit_price'] = active_offer.discounted_price
                    else:
                        item_data['unit_price'] = menu_item.price
                OrderItem.objects.create(order=order, **item_data)
                
            if order.table and order.order_type == Order.OrderType.DINE_IN:
                order.table.status = 'occupied'
                order.table.save()
                
            order.update_total()
            order.calculate_loyalty_points()
            return order

class OrderEditItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'quantity', 'notes']

class OrderEditSerializer(serializers.ModelSerializer):
    items = OrderEditItemSerializer(many=True)
    class Meta:
        model = Order
        fields = ['notes', 'items', 'discount_percentage']
        
    def validate(self, data):
        if 'items' in data and not data['items']:
            raise serializers.ValidationError({"items": "الطلب يجب أن يحتوي على الأقل على صنف واحد."})
        return data
