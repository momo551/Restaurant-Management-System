from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Count
from decimal import Decimal, InvalidOperation as DecimalException
from .models import Customer, LoyaltyPoint, Coupon, Campaign

from .serializers import CustomerSerializer, LoyaltyPointSerializer, CouponSerializer, CampaignSerializer
from users.permissions import IsStaff


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = Campaign.objects.all()
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        campaign = self.get_object()
        
        multiplier = request.data.get('multiplier')
        if multiplier is not None:
            try:
                campaign.multiplier = Decimal(str(multiplier))
            except (ValueError, TypeError, DecimalException):
                return Response({"error": "قيمة المضاعف غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)
        
        campaign.is_active = not campaign.is_active
        campaign.save()
        return Response({
            'status': 'success',
            'is_active': campaign.is_active,
            'multiplier': campaign.multiplier,
            'message': f"تم {'تفعيل' if campaign.is_active else 'إلغاء تفعيل'} الحملة بنجاح."
        })

    @action(detail=False, methods=['get'])
    def active(self, request):
        restaurant = getattr(request.user, 'restaurant', None)
        campaign = Campaign.get_active_campaign(restaurant=restaurant)
        if not campaign:
            return Response(None, status=status.HTTP_200_OK)
        return Response(CampaignSerializer(campaign).data)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = Customer.objects.all()
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get analytics for the loyalty program."""
        cust_qs = self.get_queryset()
        most_visited = cust_qs.annotate(
            visits=Count('orders')
        ).order_by('-visits')[:5]

        highest_spending = cust_qs.annotate(
            visits=Count('orders')
        ).order_by('-total_spent')[:5]

        lp_qs = LoyaltyPoint.objects.filter(customer__in=cust_qs)
        total_points_redeemed = lp_qs.filter(
            transaction_type=LoyaltyPoint.TransactionType.REDEEMED
        ).aggregate(total=Sum('points'))['total'] or 0

        coupon_qs = Coupon.objects.all()
        if request.user and request.user.is_authenticated and not request.user.is_superuser and request.user.restaurant_id:
            coupon_qs = coupon_qs.filter(restaurant_id=request.user.restaurant_id)
        coupons_used_count = coupon_qs.filter(used_at__isnull=False).count()

        return Response({
            'most_visited': CustomerSerializer(most_visited, many=True).data,
            'highest_spending': CustomerSerializer(highest_spending, many=True).data,
            'total_points_redeemed': total_points_redeemed,
            'coupons_used_count': coupons_used_count,
            'total_customers': cust_qs.count()
        })


class LoyaltyPointViewSet(viewsets.ModelViewSet):
    queryset = LoyaltyPoint.objects.all()
    serializer_class = LoyaltyPointSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = LoyaltyPoint.objects.all()
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(customer__restaurant_id=user.restaurant_id)
        return qs.none()


class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all()
    serializer_class = CouponSerializer
    permission_classes = [IsStaff]

    def get_queryset(self):
        user = self.request.user
        qs = Coupon.objects.all()
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()
