from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from tenants.models import Restaurant
from users.models import User, ModulePermission
from menu.models import Category, MenuItem
from tables.models import Table
from orders.models import Order
from stock.models import Ingredient, Supplier
from loyalty.models import Customer, Campaign, Coupon
from billing.models import Invoice
from decimal import Decimal


class MultiTenantIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create two separate restaurant tenants
        self.restaurant_a = Restaurant.objects.create(
            name='مطعم الشروق',
            slug='shorouk',
            phone='01111111111'
        )
        self.restaurant_b = Restaurant.objects.create(
            name='مطعم النيل',
            slug='nile',
            phone='02222222222'
        )

        # Create users for each restaurant
        self.user_a = User.objects.create_user(
            username='owner_a',
            password='Password123!',
            role=User.Role.OWNER,
            restaurant=self.restaurant_a
        )
        self.user_b = User.objects.create_user(
            username='owner_b',
            password='Password123!',
            role=User.Role.OWNER,
            restaurant=self.restaurant_b
        )

        # Create manager users
        self.manager_a = User.objects.create_user(
            username='manager_a',
            password='Password123!',
            role=User.Role.MANAGER,
            restaurant=self.restaurant_a
        )

        # Setup permissions for manager_a
        for module in ['pos', 'tables', 'reports', 'dashboard', 'menu', 'delivery_monitor', 'orders', 'staff', 'ingredients']:
            ModulePermission.objects.create(
                restaurant=self.restaurant_a,
                role=User.Role.MANAGER,
                module_key=module,
                module_label=module,
                allowed=True
            )

        # Create domain data for Restaurant A
        self.cat_a = Category.objects.create(name='مشويات الشروق', restaurant=self.restaurant_a)
        self.item_a = MenuItem.objects.create(name='كباب الشروق', category=self.cat_a, price=Decimal('150.00'))
        self.table_a = Table.objects.create(number=1, restaurant=self.restaurant_a)
        self.order_a = Order.objects.create(order_number='ORD-A1', restaurant=self.restaurant_a, total=Decimal('150.00'))
        self.ing_a = Ingredient.objects.create(name='لحم ضاني', unit='كجم', quantity=Decimal('50'), restaurant=self.restaurant_a)
        self.sup_a = Supplier.objects.create(name='مورد لحوم الشروق', phone='0101', restaurant=self.restaurant_a)
        self.cust_a = Customer.objects.create(name='عميل أ', phone='01000000001', restaurant=self.restaurant_a)
        self.campaign_a = Campaign.objects.create(
            name='حملة الشروق', multiplier=Decimal('2.0'),
            start_date='2026-01-01T00:00:00Z', end_date='2027-01-01T00:00:00Z',
            restaurant=self.restaurant_a
        )
        self.coupon_a = Coupon.objects.create(
            code='SHOROUK10', discount_amount=Decimal('10.00'),
            valid_until='2027-01-01T00:00:00Z', restaurant=self.restaurant_a
        )
        self.invoice_a = Invoice.objects.create(
            order=self.order_a, invoice_number='INV-A1',
            subtotal=Decimal('150.00'), total_amount=Decimal('150.00')
        )

        # Create domain data for Restaurant B
        self.cat_b = Category.objects.create(name='مشروبات النيل', restaurant=self.restaurant_b)
        self.item_b = MenuItem.objects.create(name='عصير النيل', category=self.cat_b, price=Decimal('30.00'))
        self.table_b = Table.objects.create(number=1, restaurant=self.restaurant_b) # Same table number allowed in different restaurant
        self.order_b = Order.objects.create(order_number='ORD-B1', restaurant=self.restaurant_b, total=Decimal('30.00'))
        self.ing_b = Ingredient.objects.create(name='برتقال', unit='كجم', quantity=Decimal('100'), restaurant=self.restaurant_b)
        self.sup_b = Supplier.objects.create(name='مورد فواكه النيل', phone='0102', restaurant=self.restaurant_b)
        self.cust_b = Customer.objects.create(name='عميل ب', phone='01000000001', restaurant=self.restaurant_b) # Same phone allowed in different restaurant
        self.campaign_b = Campaign.objects.create(
            name='حملة النيل', multiplier=Decimal('1.5'),
            start_date='2026-01-01T00:00:00Z', end_date='2027-01-01T00:00:00Z',
            restaurant=self.restaurant_b
        )
        self.coupon_b = Coupon.objects.create(
            code='NILE10', discount_amount=Decimal('10.00'),
            valid_until='2027-01-01T00:00:00Z', restaurant=self.restaurant_b
        )

    def _get_items(self, response_data):
        if isinstance(response_data, list):
            return response_data
        elif isinstance(response_data, dict) and 'results' in response_data:
            return response_data['results']
        return []

    def test_unique_together_per_tenant(self):
        """Verify duplicate table numbers and customer phones can coexist across tenants."""
        self.assertEqual(self.table_a.number, self.table_b.number)
        self.assertNotEqual(self.table_a.restaurant_id, self.table_b.restaurant_id)
        self.assertEqual(self.cust_a.phone, self.cust_b.phone)
        self.assertNotEqual(self.cust_a.restaurant_id, self.cust_b.restaurant_id)

    def test_tenant_isolation_categories(self):
        """User from Restaurant A should only see categories from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/menu/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = self._get_items(response.data)
        names = [c['name'] for c in items]
        self.assertIn('مشويات الشروق', names)
        self.assertNotIn('مشروبات النيل', names)

    def test_tenant_isolation_menu_items(self):
        """User from Restaurant A should only see menu items from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/menu/items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = self._get_items(response.data)
        names = [item['name'] for item in items]
        self.assertIn('كباب الشروق', names)
        self.assertNotIn('عصير النيل', names)

    def test_tenant_isolation_tables(self):
        """User from Restaurant A should only see tables from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/tables/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tables = self._get_items(response.data)
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0]['id'], self.table_a.id)

    def test_tenant_isolation_orders(self):
        """User from Restaurant A should only see orders from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        orders = self._get_items(response.data)
        order_numbers = [o['order_number'] for o in orders]
        self.assertIn('ORD-A1', order_numbers)
        self.assertNotIn('ORD-B1', order_numbers)

    def test_tenant_isolation_ingredients(self):
        """User from Restaurant A should only see ingredients from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/stock/ingredients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        names = [ing['name'] for ing in results]
        self.assertIn('لحم ضاني', names)
        self.assertNotIn('برتقال', names)

    def test_tenant_isolation_suppliers(self):
        """User from Restaurant A should only see suppliers from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/stock/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        names = [s['name'] for s in results]
        self.assertIn('مورد لحوم الشروق', names)
        self.assertNotIn('مورد فواكه النيل', names)

    def test_tenant_isolation_customers(self):
        """User from Restaurant A should only see customers from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/loyalty/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        names = [c['name'] for c in results]
        self.assertIn('عميل أ', names)
        self.assertNotIn('عميل ب', names)

    def test_tenant_isolation_campaigns(self):
        """User from Restaurant A should only see campaigns from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/loyalty/campaigns/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        names = [c['name'] for c in results]
        self.assertIn('حملة الشروق', names)
        self.assertNotIn('حملة النيل', names)

    def test_tenant_isolation_coupons(self):
        """User from Restaurant A should only see coupons from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/loyalty/coupons/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        codes = [c['code'] for c in results]
        self.assertIn('SHOROUK10', codes)
        self.assertNotIn('NILE10', codes)

    def test_tenant_isolation_users(self):
        """User from Restaurant A should only see users from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        usernames = [u['username'] for u in results]
        self.assertIn('owner_a', usernames)
        self.assertIn('manager_a', usernames)
        self.assertNotIn('owner_b', usernames)

    def test_tenant_isolation_invoices(self):
        """User from Restaurant A should only see invoices from Restaurant A."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/billing/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_items(response.data)
        inv_numbers = [inv['invoice_number'] for inv in results]
        self.assertIn('INV-A1', inv_numbers)

    def test_create_assigns_tenant_automatically(self):
        """Creating an object via API automatically scopes it to the user's restaurant."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/tables/', {
            'number': 99,
            'capacity': 6,
            'floor': 1
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_table = Table.objects.get(number=99, restaurant=self.restaurant_a)
        self.assertEqual(created_table.restaurant_id, self.restaurant_a.id)

    def test_jwt_token_payload_includes_tenant(self):
        """Login token should include restaurant details in response."""
        response = self.client.post('/api/token/', {
            'username': 'owner_a',
            'password': 'Password123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['restaurant_id'], self.restaurant_a.id)
        self.assertEqual(response.data['user']['restaurant_name'], 'مطعم الشروق')

    def test_public_menu_requires_a_valid_active_slug(self):
        response = self.client.get('/api/public/shorouk/menu/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [category['name'] for category in response.data]
        self.assertIn('مشويات الشروق', names)
        self.assertNotIn('مشروبات النيل', names)

        self.assertEqual(self.client.get('/api/public/missing/menu/').status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get('/api/public/menu/').status_code, status.HTTP_404_NOT_FOUND)

        self.restaurant_b.is_active = False
        self.restaurant_b.save(update_fields=['is_active'])
        self.assertEqual(self.client.get('/api/public/nile/menu/').status_code, status.HTTP_404_NOT_FOUND)

    def test_public_order_uses_slug_not_submitted_restaurant_id(self):
        response = self.client.post('/api/public/shorouk/orders/', {
            'customer_name': 'عميل عام',
            'customer_phone': '01009999999',
            'order_type': Order.OrderType.DELIVERY,
            'restaurant_id': self.restaurant_b.id,
            'items': [{'menu_item': self.item_a.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(id=response.data['id'])
        self.assertEqual(order.restaurant_id, self.restaurant_a.id)

    def test_public_order_rejects_cross_tenant_menu_item(self):
        response = self.client.post('/api/public/shorouk/orders/', {
            'customer_name': 'عميل عام',
            'customer_phone': '01008888888',
            'order_type': Order.OrderType.DELIVERY,
            'restaurant_id': self.restaurant_b.id,
            'items': [{'menu_item': self.item_b.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.filter(customer_phone='01008888888').exists())
