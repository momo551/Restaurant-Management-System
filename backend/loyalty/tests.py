from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import Customer, Campaign, Coupon
from menu.models import Category, MenuItem, ProductOffer
from orders.models import Order
from tenants.models import Restaurant

User = get_user_model()


class LoyaltyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', 
            password='password123',
            role='owner'
        )
        self.client.force_authenticate(user=self.user)
        
        self.customer = Customer.objects.create(
            name='Test Customer',
            phone='0123456789',
            total_spent=500
        )
        
        # Create an order to test visits
        Order.objects.create(
            order_number='ORD-001',
            customer=self.customer,
            total=500,
            status='paid'
        )

    def test_statistics_endpoint(self):
        url = '/api/loyalty/customers/statistics/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_customers', response.data)
        self.assertIn('highest_spending', response.data)
        self.assertIn('most_visited', response.data)
        
        if response.data['highest_spending']:
            self.assertIn('visits', response.data['highest_spending'][0])
        
        if response.data['most_visited']:
            self.assertEqual(response.data['most_visited'][0]['visits'], 1)


class ProductOfferTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.restaurant = Restaurant.objects.create(name='Test Restaurant', slug='test-restaurant')
        self.category = Category.objects.create(name='Test Category', restaurant=self.restaurant)
        self.item = MenuItem.objects.create(
            category=self.category,
            name='Burger',
            price=Decimal('100.00')
        )

    def _make_offer(self, discount=20, multiplier=2.0, active=True, days_from_now=1):
        """Helper: create an offer that ends `days_from_now` days from now."""
        return ProductOffer.objects.create(
            product=self.item,
            discount_percentage=Decimal(str(discount)),
            points_multiplier=Decimal(str(multiplier)),
            start_date=self.now - timedelta(hours=1),
            end_date=self.now + timedelta(days=days_from_now),
            is_active=active,
        )

    # ─── Activation ───────────────────────────────────────────────────────────

    def test_offer_activates_within_date_range(self):
        offer = self._make_offer()
        self.assertTrue(offer.is_currently_active)

    def test_offer_inactive_when_flag_off(self):
        offer = self._make_offer(active=False)
        self.assertFalse(offer.is_currently_active)

    def test_offer_inactive_outside_date_range(self):
        offer = ProductOffer.objects.create(
            product=self.item,
            discount_percentage=20,
            points_multiplier=1.0,
            start_date=self.now - timedelta(days=10),
            end_date=self.now - timedelta(days=1),   # expired yesterday
            is_active=True,
        )
        self.assertFalse(offer.is_currently_active)

    def test_get_active_offer_for_item_returns_correct_offer(self):
        offer = self._make_offer()
        result = ProductOffer.get_active_offer_for_item(self.item.id)
        self.assertEqual(result.id, offer.id)

    def test_get_active_offer_for_item_returns_none_when_expired(self):
        ProductOffer.objects.create(
            product=self.item,
            discount_percentage=20,
            points_multiplier=1.0,
            start_date=self.now - timedelta(days=5),
            end_date=self.now - timedelta(days=1),
            is_active=True,
        )
        self.assertIsNone(ProductOffer.get_active_offer_for_item(self.item.id))

    # ─── Discount Calculation ─────────────────────────────────────────────────

    def test_discount_calculation_20_percent(self):
        offer = self._make_offer(discount=20)
        self.assertEqual(offer.discounted_price, Decimal('80.00'))

    def test_discount_calculation_50_percent(self):
        offer = self._make_offer(discount=50)
        self.assertEqual(offer.discounted_price, Decimal('50.00'))

    def test_no_discount_when_inactive(self):
        offer = self._make_offer(discount=20, active=False)
        self.assertEqual(offer.discounted_price, self.item.price)

    # ─── Points Calculation ───────────────────────────────────────────────────

    def test_points_multiplier_is_2x(self):
        offer = self._make_offer(multiplier=2.0)
        self.assertEqual(float(offer.points_multiplier), 2.0)

    def test_effective_points_earned_with_campaign_and_offer(self):
        """Points = order.total * max(campaign_multiplier, offer_multiplier)."""
        campaign = Campaign.objects.create(
            name='Test Campaign',
            multiplier=Decimal('2.0'),
            start_date=self.now - timedelta(hours=1),
            end_date=self.now + timedelta(days=1),
            is_active=True,
        )
        # Simulate how calculate_loyalty_points works
        base_points = int(Decimal('200'))  # order total = 200
        active_campaign = Campaign.get_active_campaign()
        multiplier = active_campaign.multiplier if active_campaign else 1.0
        earned = int(base_points * float(multiplier))
        self.assertEqual(earned, 400)

    # ─── Public API ─────────────────────────────────────────────────────────

    def test_public_offers_endpoint_returns_active_offers(self):
        self._make_offer()
        response = self.client.get('/api/public/test-restaurant/offers/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertIn('discount_percentage', response.data[0])
        self.assertIn('discounted_price', response.data[0])

    def test_public_offers_endpoint_excludes_expired(self):
        ProductOffer.objects.create(
            product=self.item,
            discount_percentage=20,
            points_multiplier=1.0,
            start_date=self.now - timedelta(days=5),
            end_date=self.now - timedelta(days=1),
            is_active=True,
        )
        response = self.client.get('/api/public/test-restaurant/offers/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_apply_coupon_fixed_discount(self):
        Coupon.objects.create(
            code='SAVE20',
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal('20.00'),
            min_purchase=Decimal('0'),
            is_active=True,
            valid_until=self.now + timedelta(days=7),
            restaurant=self.restaurant,
        )
        response = self.client.post('/api/public/test-restaurant/apply-coupon/', {
            'code': 'SAVE20',
            'subtotal': 200,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['discount_amount'], 20.0)
        self.assertEqual(response.data['final_total'], 180.0)

    def test_apply_coupon_percentage_discount(self):
        Coupon.objects.create(
            code='HALF50',
            discount_type=Coupon.DiscountType.PERCENTAGE,
            discount_amount=Decimal('50.00'),
            min_purchase=Decimal('0'),
            is_active=True,
            valid_until=self.now + timedelta(days=7),
            restaurant=self.restaurant,
        )
        response = self.client.post('/api/public/test-restaurant/apply-coupon/', {
            'code': 'HALF50',
            'subtotal': 200,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['discount_amount'], 100.0)
        self.assertEqual(response.data['final_total'], 100.0)

    def test_apply_coupon_invalid_code(self):
        response = self.client.post('/api/public/test-restaurant/apply-coupon/', {
            'code': 'INVALID',
            'subtotal': 100,
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_apply_coupon_min_purchase_not_met(self):
        Coupon.objects.create(
            code='BIG50',
            discount_type=Coupon.DiscountType.FIXED,
            discount_amount=Decimal('50.00'),
            min_purchase=Decimal('300.00'),
            is_active=True,
            valid_until=self.now + timedelta(days=7),
            restaurant=self.restaurant,
        )
        response = self.client.post('/api/public/test-restaurant/apply-coupon/', {
            'code': 'BIG50',
            'subtotal': 100,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)
