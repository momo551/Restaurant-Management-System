import threading
from decimal import Decimal
from django.test import TransactionTestCase, TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction, connection
from rest_framework.test import APIClient
from rest_framework import status

from tenants.models import Restaurant
from menu.models import Category, MenuItem
from orders.models import Order, OrderItem, DailyOrderSequence
from orders.serializers import OrderSerializer
from tables.models import Table, TableSession

User = get_user_model()


class Phase6ADailyIdConcurrencyTests(TransactionTestCase):
    """
    Phase 6A Concurrency and Transaction-Safety Tests for Daily ID sequence generation.
    Uses TransactionTestCase to allow real concurrent threads with database transactions.
    """

    def setUp(self):
        self.restaurant_a = Restaurant.objects.create(
            name="Alpha Restaurant",
            slug="alpha-rest",
            is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Beta Restaurant",
            slug="beta-rest",
            is_active=True
        )
        self.cat_a = Category.objects.create(name="Cat A", restaurant=self.restaurant_a)
        self.item_a = MenuItem.objects.create(name="Burger A", price=Decimal("50.00"), category=self.cat_a)

        self.cat_b = Category.objects.create(name="Cat B", restaurant=self.restaurant_b)
        self.item_b = MenuItem.objects.create(name="Burger B", price=Decimal("60.00"), category=self.cat_b)

    def test_single_thread_sequential_daily_ids(self):
        """Verify sequential daily_id progression (1, 2, 3) for a single tenant."""
        today = timezone.localdate()
        date_str = today.strftime('%Y%m%d')

        id1 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
        id2 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
        id3 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)

        self.assertEqual(id1, 1)
        self.assertEqual(id2, 2)
        self.assertEqual(id3, 3)

    def test_multi_tenant_independent_sequences(self):
        """Verify that Restaurant A and Restaurant B have completely independent sequences on the same day."""
        today = timezone.localdate()

        id_a1 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
        id_b1 = DailyOrderSequence.get_next_daily_id(self.restaurant_b, today)
        id_a2 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
        id_b2 = DailyOrderSequence.get_next_daily_id(self.restaurant_b, today)

        self.assertEqual(id_a1, 1)
        self.assertEqual(id_b1, 1)
        self.assertEqual(id_a2, 2)
        self.assertEqual(id_b2, 2)

    def test_concurrent_daily_id_generation_same_restaurant(self):
        """
        Verify that multiple concurrent threads creating orders for the same restaurant
        receive strictly unique daily_ids without collisions or IntegrityErrors.
        """
        num_threads = 6
        results = []
        errors = []

        def worker():
            try:
                # Open isolated connection for each thread
                with transaction.atomic():
                    daily_id = DailyOrderSequence.get_next_daily_id(self.restaurant_a)
                    today = timezone.localdate()
                    order = Order.objects.create(
                        restaurant=self.restaurant_a,
                        order_number=f"ORD-{today.strftime('%Y%m%d')}-{daily_id:03d}",
                        daily_id=daily_id,
                        order_type=Order.OrderType.TAKEAWAY,
                        total=Decimal("50.00")
                    )
                    results.append(order.daily_id)
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Errors occurred during concurrent order creation: {errors}")
        self.assertEqual(len(results), num_threads)
        # Ensure all daily_ids are strictly unique
        self.assertEqual(len(set(results)), num_threads)
        self.assertEqual(sorted(results), list(range(1, num_threads + 1)))

    def test_concurrent_orders_across_multiple_tenants(self):
        """
        Verify concurrent order creation across Restaurant A and Restaurant B simultaneously.
        """
        num_orders_per_tenant = 4
        results_a = []
        results_b = []
        errors = []

        def worker_a():
            try:
                with transaction.atomic():
                    daily_id = DailyOrderSequence.get_next_daily_id(self.restaurant_a)
                    today = timezone.localdate()
                    order = Order.objects.create(
                        restaurant=self.restaurant_a,
                        order_number=f"ORD-{today.strftime('%Y%m%d')}-{daily_id:03d}",
                        daily_id=daily_id,
                        order_type=Order.OrderType.TAKEAWAY,
                        total=Decimal("50.00")
                    )
                    results_a.append(order.daily_id)
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        def worker_b():
            try:
                with transaction.atomic():
                    daily_id = DailyOrderSequence.get_next_daily_id(self.restaurant_b)
                    today = timezone.localdate()
                    order = Order.objects.create(
                        restaurant=self.restaurant_b,
                        order_number=f"ORD-{today.strftime('%Y%m%d')}-{daily_id:03d}",
                        daily_id=daily_id,
                        order_type=Order.OrderType.TAKEAWAY,
                        total=Decimal("60.00")
                    )
                    results_b.append(order.daily_id)
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        threads = []
        for _ in range(num_orders_per_tenant):
            threads.append(threading.Thread(target=worker_a))
            threads.append(threading.Thread(target=worker_b))

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0, f"Concurrent multi-tenant errors: {errors}")
        self.assertEqual(sorted(results_a), list(range(1, num_orders_per_tenant + 1)))
        self.assertEqual(sorted(results_b), list(range(1, num_orders_per_tenant + 1)))

    def test_rollback_safety(self):
        """
        Verify that a rolled-back transaction does not corrupt subsequent sequence increments.
        """
        today = timezone.localdate()

        # Step 1: Successful order
        with transaction.atomic():
            id1 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
            Order.objects.create(
                restaurant=self.restaurant_a,
                order_number=f"ORD-{today.strftime('%Y%m%d')}-{id1:03d}",
                daily_id=id1,
                total=Decimal("50.00")
            )
        self.assertEqual(id1, 1)

        # Step 2: Failed transaction that gets rolled back
        try:
            with transaction.atomic():
                DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
                raise ValueError("Simulated unexpected failure during order creation")
        except ValueError:
            pass

        # Step 3: Next order succeeds cleanly without collision or sequence lock hang
        with transaction.atomic():
            id3 = DailyOrderSequence.get_next_daily_id(self.restaurant_a, today)
            order3 = Order.objects.create(
                restaurant=self.restaurant_a,
                order_number=f"ORD-{today.strftime('%Y%m%d')}-{id3:03d}",
                daily_id=id3,
                total=Decimal("50.00")
            )
        self.assertIsNotNone(order3.id)


class Phase6ATracebackAndSecurityTests(TestCase):
    """
    Tests for C-03 (Traceback leakage remediation) and C-01 (Secrets protection).
    """

    def setUp(self):
        self.client = APIClient()
        self.restaurant = Restaurant.objects.create(
            name="Security Test Rest",
            slug="sec-test",
            is_active=True
        )
        self.table = Table.objects.create(
            number=99,
            restaurant=self.restaurant,
            capacity=4
        )

    def test_public_create_session_no_traceback_on_error(self):
        """
        Verify that create_session returns a generic error and never exposes python tracebacks.
        """
        # Trigger an invalid session creation (invalid table ID format / non-existent)
        response = self.client.post(
            '/api/tables/sessions/create_session/',
            {'table_id': 999999, 'restaurant_slug': 'sec-test'},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST, status.HTTP_500_INTERNAL_SERVER_ERROR])
        self.assertNotIn('traceback', response.data)
        
        # Also test with missing data to hit generic exception handling if applicable
        response_malformed = self.client.post(
            '/api/tables/sessions/create_session/',
            {'table_id': 'invalid_string_not_int', 'restaurant_slug': 'sec-test'},
            format='json'
        )
        self.assertNotIn('traceback', response_malformed.data)
        if response_malformed.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR:
            self.assertEqual(response_malformed.data.get('error'), 'حدث خطأ غير متوقع')

    def test_order_serializer_requires_restaurant_context(self):
        """
        Verify OrderSerializer enforces restaurant context for sequence generation.
        """
        serializer = OrderSerializer(data={
            'order_type': 'takeaway',
            'items': []
        })
        self.assertFalse(serializer.is_valid())
