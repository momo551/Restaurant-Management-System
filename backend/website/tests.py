from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from menu.models import Category, MenuItem
from orders.models import Order
from tenants.models import Restaurant
from users.models import ModulePermission

from .models import Testimonial, WebsiteSettings

User = get_user_model()


def make_restaurant(slug, name=None):
    return Restaurant.objects.create(
        name=name or slug,
        slug=slug,
        phone='01000000000',
        address='Test address',
        is_active=True,
    )


def make_user(username, role, restaurant):
    return User.objects.create_user(
        username=username,
        password='testpass123',
        role=role,
        restaurant=restaurant,
        is_active=True,
    )


def make_category(restaurant, name='Main'):
    return Category.objects.create(restaurant=restaurant, name=name, is_active=True)


def make_item(category, name='Item', price='10.00', is_available=True):
    return MenuItem.objects.create(
        category=category,
        name=name,
        price=price,
        is_available=is_available,
        display_order=0,
    )


class WebsiteSettingsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.restaurant = make_restaurant('resto-a')
        self.other = make_restaurant('resto-b')
        self.owner = make_user('owner_a', 'owner', self.restaurant)
        self.manager = make_user('manager_a', 'manager', self.restaurant)
        self.cashier = make_user('cashier_a', 'cashier', self.restaurant)

    def test_owner_can_read_and_update_draft(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get('/api/website/settings/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['restaurant_slug'], 'resto-a')

        res = self.client.patch('/api/website/settings/', {
            'content': {
                'display_name': 'مطعم أ',
                'hero_title': 'أهلاً',
                'primary_color': '#123abc',
                'show_testimonials': False,
            }
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['content']['primary_color'], '#123abc')
        self.assertFalse(res.data['content']['show_testimonials'])

    def test_invalid_color_rejected(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch('/api/website/settings/', {
            'content': {'primary_color': 'not-a-color'}
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_unknown_content_key_rejected(self):
        self.client.force_authenticate(self.owner)
        res = self.client.patch('/api/website/settings/', {
            'content': {'evil_field': 'x'}
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_manager_with_permission_can_update(self):
        # Global fallback row grants 'website' to managers (seeded by migration).
        self.client.force_authenticate(self.manager)
        res = self.client.patch('/api/website/settings/', {
            'content': {'hero_title': 'عنوان جديد'}
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_cashier_denied(self):
        self.client.force_authenticate(self.cashier)
        res = self.client.get('/api/website/settings/')
        self.assertEqual(res.status_code, 403)
        res = self.client.patch('/api/website/settings/', {
            'content': {'hero_title': 'x'}
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_tenant_isolation(self):
        # A user from restaurant B cannot read or modify restaurant A's settings:
        # the tenant always comes from request.user.restaurant, never the payload.
        user_b = make_user('owner_b', 'owner', self.other)
        self.client.force_authenticate(user_b)
        res = self.client.get('/api/website/settings/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['restaurant_slug'], 'resto-b')

        # Even if the client injects a foreign restaurant id, it is ignored.
        WebsiteSettings.objects.create(restaurant=self.restaurant, content={'hero_title': 'A'})
        res = self.client.patch(
            f'/api/website/settings/?restaurant_id={self.restaurant.id}',
            {'content': {'hero_title': 'hacked'}},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            WebsiteSettings.objects.get(restaurant=self.other).content.get('hero_title'),
            'hacked',
        )
        self.assertEqual(
            WebsiteSettings.objects.get(restaurant=self.restaurant).content.get('hero_title'),
            'A',
        )

    def test_publish_snapshots_draft(self):
        self.client.force_authenticate(self.owner)
        self.client.patch('/api/website/settings/', {
            'content': {'hero_title': 'منشور', 'primary_color': '#00ff00'}
        }, format='json')
        res = self.client.post('/api/website/settings/publish/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['is_published'])
        self.assertIsNotNone(res.data['published_at'])

        settings_obj = WebsiteSettings.objects.get(restaurant=self.restaurant)
        self.assertEqual(settings_obj.published_content['hero_title'], 'منشور')
        self.assertEqual(settings_obj.published_content['display_name'], 'resto-a')

        # Draft edits after publish do not leak into the published snapshot.
        self.client.patch('/api/website/settings/', {
            'content': {'hero_title': 'مسودة جديدة'}
        }, format='json')
        settings_obj.refresh_from_db()
        self.assertEqual(settings_obj.published_content['hero_title'], 'منشور')
        self.assertEqual(settings_obj.content['hero_title'], 'مسودة جديدة')


class PublicWebsiteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.restaurant = make_restaurant('resto-pub')
        self.owner = make_user('owner_pub', 'owner', self.restaurant)

    def test_public_returns_defaults_when_unpublished(self):
        res = self.client.get('/api/public/resto-pub/website/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_published'])
        self.assertEqual(res.data['settings']['display_name'], 'resto-pub')
        self.assertEqual(res.data['restaurant']['slug'], 'resto-pub')

    def test_public_returns_published_only(self):
        api = APIClient()
        api.force_authenticate(self.owner)
        api.patch('/api/website/settings/', {
            'content': {'hero_title': 'عنوان الموقع', 'primary_color': '#abcdef'}
        }, format='json')
        api.post('/api/website/settings/publish/')
        # Draft-only change must NOT appear publicly.
        api.patch('/api/website/settings/', {
            'content': {'hero_title': 'مسودة سرية'}
        }, format='json')

        res = self.client.get('/api/public/resto-pub/website/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['is_published'])
        self.assertEqual(res.data['settings']['hero_title'], 'عنوان الموقع')
        self.assertEqual(res.data['settings']['primary_color'], '#abcdef')

    def test_public_unknown_slug_404(self):
        res = self.client.get('/api/public/no-such-slug/website/')
        self.assertEqual(res.status_code, 404)


class TestimonialTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.restaurant = make_restaurant('resto-t')
        self.other = make_restaurant('resto-t2')
        self.owner = make_user('owner_t', 'owner', self.restaurant)
        self.cashier = make_user('cashier_t', 'cashier', self.restaurant)

    def _create(self, **kwargs):
        payload = {
            'author_name': 'أحمد',
            'text': 'طعم رائع',
            'rating': 5,
            'is_published': False,
            'display_order': 0,
        }
        payload.update(kwargs)
        return self.client.post('/api/website/testimonials/', payload, format='json')

    def test_create_and_publish_flow(self):
        self.client.force_authenticate(self.owner)
        res = self._create()
        self.assertEqual(res.status_code, 201, res.data)
        tid = res.data['id']
        self.assertEqual(res.data['source'], 'admin_added')
        self.assertEqual(res.data['restaurant'], self.restaurant.id)

        # Hidden by default: not visible publicly.
        pub = APIClient().get('/api/public/resto-t/website/')
        self.assertEqual(len(pub.data['testimonials']), 0)

        res = self.client.post(f'/api/website/testimonials/{tid}/publish/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['is_published'])

        pub = APIClient().get('/api/public/resto-t/website/')
        self.assertEqual(len(pub.data['testimonials']), 1)
        self.assertEqual(pub.data['testimonials'][0]['author_name'], 'أحمد')
        self.assertEqual(pub.data['testimonials'][0]['rating'], 5)

        # Unpublish hides it again; the record is kept.
        res = self.client.post(f'/api/website/testimonials/{tid}/unpublish/')
        self.assertEqual(res.status_code, 200)
        pub = APIClient().get('/api/public/resto-t/website/')
        self.assertEqual(len(pub.data['testimonials']), 0)
        self.assertTrue(Testimonial.objects.filter(id=tid).exists())

    def test_rating_validation(self):
        self.client.force_authenticate(self.owner)
        res = self._create(rating=9)
        self.assertEqual(res.status_code, 400)

    def test_cashier_cannot_manage_testimonials(self):
        self.client.force_authenticate(self.cashier)
        res = self._create()
        self.assertEqual(res.status_code, 403)

    def test_cross_tenant_isolation(self):
        owner_b = make_user('owner_t2', 'owner', self.other)
        client_b = APIClient()
        client_b.force_authenticate(owner_b)

        # B cannot see A's testimonials.
        self.client.force_authenticate(self.owner)
        res = self._create()
        tid = res.data['id']

        res = client_b.get('/api/website/testimonials/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 0)

        # B cannot publish/unpublish/delete A's testimonial (404 via scoped queryset).
        res = client_b.post(f'/api/website/testimonials/{tid}/publish/')
        self.assertEqual(res.status_code, 404)


class ProductAvailabilityTests(TestCase):
    """Disabling a menu item must block customer ordering but keep history."""

    def setUp(self):
        self.client = APIClient()
        self.restaurant = make_restaurant('resto-m')
        self.category = make_category(self.restaurant)
        self.item = make_item(self.category, name='Burger', price='50.00')

    def _order_payload(self):
        return {
            'customer_name': 'Test Customer',
            'customer_phone': '01012345678',
            'order_type': 'delivery',
            'delivery_address': 'Somewhere',
            'items': [{'menu_item': self.item.id, 'quantity': 2}],
        }

    def test_public_order_with_available_item(self):
        res = self.client.post(
            '/api/public/resto-m/orders/', self._order_payload(), format='json'
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_disabled_item_rejected_on_public_order(self):
        self.item.is_available = False
        self.item.save()
        res = self.client.post(
            '/api/public/resto-m/orders/', self._order_payload(), format='json'
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('items', res.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_deleted_item_rejected_on_public_order(self):
        self.item.is_deleted = True
        self.item.save()
        res = self.client.post(
            '/api/public/resto-m/orders/', self._order_payload(), format='json'
        )
        self.assertEqual(res.status_code, 400)

    def test_reenable_allows_ordering_again(self):
        self.item.is_available = False
        self.item.save()
        self.client.post('/api/public/resto-m/orders/', self._order_payload(), format='json')
        self.item.is_available = True
        self.item.save()
        res = self.client.post(
            '/api/public/resto-m/orders/', self._order_payload(), format='json'
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_historical_orders_survive_disable(self):
        res = self.client.post(
            '/api/public/resto-m/orders/', self._order_payload(), format='json'
        )
        self.assertEqual(res.status_code, 201)
        order_id = res.data['id']

        self.item.is_available = False
        self.item.save()

        order = Order.objects.get(id=order_id)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().menu_item_id, self.item.id)
        # The item itself is preserved, not deleted.
        self.assertTrue(MenuItem.objects.filter(id=self.item.id).exists())

    def test_public_menu_hides_unavailable_items(self):
        res = self.client.get('/api/public/resto-m/menu/')
        self.assertEqual(res.status_code, 200)
        items = [i for c in res.data for i in c['items']]
        self.assertEqual(len(items), 1)

        self.item.is_available = False
        self.item.save()
        res = self.client.get('/api/public/resto-m/menu/')
        items = [i for c in res.data for i in c['items']]
        self.assertEqual(len(items), 0)
