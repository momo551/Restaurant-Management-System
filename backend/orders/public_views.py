from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from menu.models import Category, MenuItem, ProductOffer
from menu.serializers import CategorySerializer, ProductOfferSerializer
from .models import Order
from .serializers import OrderSerializer
from loyalty.models import Campaign, Customer, Coupon
from loyalty.serializers import CampaignSerializer, CustomerSerializer
from tenants.models import Restaurant
from django.utils import timezone
from decimal import Decimal
from django.db import transaction


class PublicRestaurantContextMixin:
    """Resolve the public tenant solely from the slug embedded in the URL."""

    def get_restaurant(self):
        return get_object_or_404(
            Restaurant.objects.filter(is_active=True),
            slug=self.kwargs['restaurant_slug'],
        )

    @staticmethod
    def validate_items_belong_to_restaurant(items, restaurant):
        invalid_item_ids = [
            item['menu_item'].id
            for item in items
            if item['menu_item'].category.restaurant_id != restaurant.id
        ]
        if invalid_item_ids:
            return Response(
                {'items': 'All ordered products must belong to this restaurant.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None


class PublicMenuView(PublicRestaurantContextMixin, APIView):
    """View to fetch the full menu for public customers."""
    permission_classes = [AllowAny]

    def get(self, request, restaurant_slug=None):
        restaurant = self.get_restaurant()
        categories = Category.objects.filter(
            is_active=True,
            is_deleted=False,
            restaurant=restaurant,
        ).prefetch_related('items')
        serializer = CategorySerializer(categories, many=True, context={'request': request})
        return Response(serializer.data)


class PublicOrderTrackView(PublicRestaurantContextMixin, APIView):
    """View to track an order status."""
    permission_classes = [AllowAny]

    def get(self, request, order_number, restaurant_slug=None):
        phone = request.query_params.get('phone')
        if not phone:
            return Response({"error": "Phone number is required for tracking."}, status=status.HTTP_400_BAD_REQUEST)
        
        restaurant = self.get_restaurant()
        order = get_object_or_404(
            Order.objects.filter(restaurant=restaurant),
            order_number=order_number,
            customer_phone=phone,
        )
        serializer = OrderSerializer(order)
        return Response(serializer.data)


class PublicCampaignView(PublicRestaurantContextMixin, APIView):
    """View to fetch the currently active campaign."""
    permission_classes = [AllowAny]

    def get(self, request, restaurant_slug=None):
        restaurant = self.get_restaurant()
        campaign = Campaign.get_active_campaign(restaurant=restaurant)
        if campaign:
            serializer = CampaignSerializer(campaign)
            return Response(serializer.data)
        return Response(None)


class PublicCustomerInfoView(PublicRestaurantContextMixin, APIView):
    """View to fetch minimal customer info using phone number."""
    permission_classes = [AllowAny]

    def post(self, request, restaurant_slug=None):
        phone = request.data.get('phone')
        if not phone:
            return Response({"error": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        restaurant = self.get_restaurant()
        customer = Customer.objects.filter(phone=phone, restaurant=restaurant).first()
        if customer:
            # Use minimal serializer to reduce information exposure
            from loyalty.serializers import PublicCustomerInfoSerializer
            serializer = PublicCustomerInfoSerializer(customer)
            return Response(serializer.data)
        return Response({"error": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)


class PublicOffersView(PublicRestaurantContextMixin, APIView):
    """View to list all currently active product offers."""
    permission_classes = [AllowAny]

    def get(self, request, restaurant_slug=None):
        restaurant = self.get_restaurant()
        now = timezone.now()
        qs = ProductOffer.objects.filter(
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
            product__category__restaurant=restaurant,
        )
        offers = qs.select_related('product')
        serializer = ProductOfferSerializer(offers, many=True, context={'request': request})
        return Response(serializer.data)


class PublicApplyCouponView(PublicRestaurantContextMixin, APIView):
    """Validate a coupon code and return the discount amount."""
    permission_classes = [AllowAny]

    def post(self, request, restaurant_slug=None):
        code = request.data.get('code', '').strip().upper()
        subtotal = request.data.get('subtotal', 0)

        if not code:
            return Response({"error": "كود الكوبون مطلوب."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            subtotal = Decimal(str(subtotal))
        except Exception:
            return Response({"error": "قيمة المجموع غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = self.get_restaurant()
        coupon = Coupon.objects.filter(
            code=code, is_active=True, restaurant=restaurant
        ).first()

        if not coupon:
            return Response({"error": "كود الكوبون غير صالح أو منتهي الصلاحية."}, status=status.HTTP_404_NOT_FOUND)

        if coupon.valid_until < timezone.now():
            return Response({"error": "انتهت صلاحية هذا الكوبون."}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.used_at:
            return Response({"error": "تم استخدام هذا الكوبون من قبل."}, status=status.HTTP_400_BAD_REQUEST)

        if subtotal < coupon.min_purchase:
            return Response({
                "error": f"الحد الأدنى للشراء لهذا الكوبون هو {coupon.min_purchase} جنيه."
            }, status=status.HTTP_400_BAD_REQUEST)

        if coupon.discount_type == Coupon.DiscountType.PERCENTAGE:
            discount = (subtotal * coupon.discount_amount / Decimal('100')).quantize(Decimal('0.01'))
        else:
            discount = min(coupon.discount_amount, subtotal)

        final_total = max(Decimal('0'), subtotal - discount)

        return Response({
            "code": coupon.code,
            "discount_type": coupon.discount_type,
            "discount_amount": float(discount),
            "final_total": float(final_total),
            "message": f"تم تطبيق الكوبون! خصم {float(discount):.0f} جنيه 🎉"
        })


class PublicOrderCreateView(PublicRestaurantContextMixin, APIView):
    """View to create an order from the public website, supporting loyalty points & coupons."""
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, restaurant_slug=None):
        phone = request.data.get('customer_phone')
        if not phone:
            return Response({"error": "customer_phone is required."}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = self.get_restaurant()

        # Get or create customer per restaurant
        customer, created = Customer.objects.get_or_create(
            phone=phone,
            restaurant=restaurant,
            defaults={'name': request.data.get('customer_name', 'عميل')}
        )

        # Sanitize incoming payload: strip client-supplied status, discounts, and driver internals
        payload = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        for privileged_field in [
            'status', 'discount_percentage', 'discount_amount',
            'delivery_agent', 'delivery_commission', 'net_revenue',
            'amount_payable_to_driver', 'is_edited'
        ]:
            payload.pop(privileged_field, None)

        # The URL-derived restaurant is the authoritative tenant for validation as
        # well as for persistence, so the serializer never falls back to a global
        # (cross-tenant) lookup.
        serializer = OrderSerializer(
            data=payload,
            context={
                'request': request,
                'public_order': True,
                'restaurant': restaurant,
            },
        )
        if serializer.is_valid():
            order_type = serializer.validated_data.get('order_type')
            if order_type == Order.OrderType.DINE_IN:
                return Response(
                    {"error": "Public orders must be Delivery or Takeaway."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            invalid_items_response = self.validate_items_belong_to_restaurant(
                serializer.validated_data['items'], restaurant
            )
            if invalid_items_response:
                return invalid_items_response

            coupon = serializer.validated_data.get('coupon')
            if coupon and coupon.restaurant_id != restaurant.id:
                return Response(
                    {'coupon_code': 'This coupon does not belong to this restaurant.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # The URL-derived restaurant is authoritative; request payloads cannot override it.
            order = serializer.save(customer=customer, restaurant=restaurant)
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
