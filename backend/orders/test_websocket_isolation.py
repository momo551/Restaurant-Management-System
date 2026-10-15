"""
WebSocket tenant-isolation regression tests for order tracking and the KDS.

Background
----------
``Order`` is unique on ``(restaurant, order_number)``, so the *same*
``order_number`` can exist in two different restaurants. The order-tracking
channel-layer group used to be named ``order_{order_number}`` — with no
restaurant scope — so a customer of restaurant A and a customer of restaurant B
that happened to share an order number joined the *same* group and received each
other's order updates (items, totals, status, notes).

The group name is now ``order_{restaurant_id}_{order_number}``, built by the
single shared helper ``orders.groups.order_tracking_group_name``, which both the
producer (``orders/signals.py``) and the consumer (``orders/consumers.py``) call.

These tests drive real consumers through ``channels.testing.WebsocketCommunicator``
and assert on what each socket actually receives, so they fail again if the group
name ever loses its restaurant scope.

Implementation notes
--------------------
``TransactionTestCase`` is used (not ``TestCase``) because the async test client
and the broadcast signal move work between threads and the event loop. That
teardown interacts badly with ``TestCase``'s wrapping ``atomic`` block, so these
tests deliberately run without it. No artificial sleeps are used: message
presence is asserted with a bounded ``receive_from`` and message *absence* with
``receive_nothing``, which is Channels' supported way to assert a socket was not
targeted.
"""

import json
from decimal import Decimal

from asgiref.sync import async_to_sync, sync_to_async
from channels.routing import URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from menu.models import Category, MenuItem
from rest_framework_simplejwt.tokens import AccessToken
from tenants.models import Restaurant

from core.middleware import TokenAuthMiddleware
from orders.groups import order_tracking_group_name
from orders.models import Order, OrderItem
from orders.routing import websocket_urlpatterns
from orders.signals import broadcast_order_update

User = get_user_model()

# Mirror the production ASGI stack (core/asgi.py) so the tests exercise the same
# origin validator and token middleware the deployed app uses. Using a bare
# URLRouter would skip TokenAuthMiddleware and leave scope["user"] unset.
ASGI_APPLICATION = AllowedHostsOriginValidator(
    TokenAuthMiddleware(URLRouter(websocket_urlpatterns))
)

# AllowedHostsOriginValidator rejects a missing/foreign Origin header. Django's
# test runner appends "testserver" to ALLOWED_HOSTS, so this Origin is accepted.
ALLOWED_ORIGIN = "http://testserver"
WS_HEADERS = [(b"origin", ALLOWED_ORIGIN.encode())]

# One order number reused by BOTH tenants on purpose: this is the exact
# condition the original bug leaked on. `unique_together = ('restaurant',
# 'order_number')` allows it.
SHARED_ORDER_NUMBER = "ORD-SHARED-001"
PHONE_A = "01000000001"
PHONE_B = "01000000002"


def _access_token_for(user):
    return str(AccessToken.for_user(user))


def _kds_communicator(token):
    """KDS communicator authenticated through the ``token`` subprotocol."""
    return WebsocketCommunicator(
        ASGI_APPLICATION,
        "/ws/kds/",
        headers=WS_HEADERS,
        subprotocols=["token", token],
    )


def _tracking_communicator(slug, order_number, phone):
    return WebsocketCommunicator(
        ASGI_APPLICATION,
        f"/ws/public/{slug}/orders/{order_number}/?phone={phone}",
        headers=WS_HEADERS,
    )


def _collect_group_sends(order):
    """
    Invoke the order broadcast signal and return the group names it targeted.

    ``channel_layer.group_send`` is patched with an ``AsyncMock`` because the
    signal drives it through ``async_to_sync`` — a plain sync stand-in would
    raise inside the signal's broad ``except`` and be silently swallowed.
    """
    from unittest.mock import AsyncMock

    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    original = channel_layer.group_send
    mock = AsyncMock()
    channel_layer.group_send = mock
    try:
        broadcast_order_update(Order, order, created=True)
    finally:
        channel_layer.group_send = original
    return [call.args[0] for call in mock.call_args_list]


def _run_scenario(coroutine_factory):
    """Run one complete connect/assert/disconnect cycle in a single event loop."""
    return async_to_sync(coroutine_factory)()


class OrderTrackingWebSocketIsolationTests(TransactionTestCase):
    """Two tenants, one shared order_number, two live customer sockets."""

    def setUp(self):
        self.restaurant_a = Restaurant.objects.create(
            name="Restaurant A", slug="restaurant-a", is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Restaurant B", slug="restaurant-b", is_active=True
        )

        self.user_a = User.objects.create_user(
            username="kds_user_a",
            password="test-pass-a",
            restaurant=self.restaurant_a,
        )
        self.user_b = User.objects.create_user(
            username="kds_user_b",
            password="test-pass-b",
            restaurant=self.restaurant_b,
        )

        self.category_a = Category.objects.create(
            name="Category A", restaurant=self.restaurant_a
        )
        self.category_b = Category.objects.create(
            name="Category B", restaurant=self.restaurant_b
        )
        self.menu_item_a = MenuItem.objects.create(
            name="Item A", price=Decimal("10.00"), category=self.category_a
        )
        self.menu_item_b = MenuItem.objects.create(
            name="Item B", price=Decimal("20.00"), category=self.category_b
        )

        # Same order_number in both tenants — allowed by (restaurant, order_number).
        self.order_a = Order.objects.create(
            order_number=SHARED_ORDER_NUMBER,
            restaurant=self.restaurant_a,
            customer_phone=PHONE_A,
            total=Decimal("10.00"),
            created_by=self.user_a,
        )
        self.order_b = Order.objects.create(
            order_number=SHARED_ORDER_NUMBER,
            restaurant=self.restaurant_b,
            customer_phone=PHONE_B,
            total=Decimal("20.00"),
            created_by=self.user_b,
        )

        self.item_a = OrderItem.objects.create(
            order=self.order_a, menu_item=self.menu_item_a,
            quantity=1, unit_price=Decimal("10.00"),
        )
        self.item_b = OrderItem.objects.create(
            order=self.order_b, menu_item=self.menu_item_b,
            quantity=1, unit_price=Decimal("20.00"),
        )

    # ---------- group-name construction ----------

    def test_group_name_includes_restaurant_and_order_number(self):
        """Group name is order_{restaurant_id}_{order_number}."""
        name = order_tracking_group_name(self.restaurant_a.id, SHARED_ORDER_NUMBER)
        self.assertEqual(name, f"order_{self.restaurant_a.id}_{SHARED_ORDER_NUMBER}")

    def test_group_name_differs_per_restaurant_for_same_order_number(self):
        """Precondition of the bug: equal order numbers must NOT share a group."""
        name_a = order_tracking_group_name(self.restaurant_a.id, SHARED_ORDER_NUMBER)
        name_b = order_tracking_group_name(self.restaurant_b.id, SHARED_ORDER_NUMBER)
        self.assertNotEqual(name_a, name_b)

    def test_group_name_has_no_tenant_scope_without_restaurant(self):
        """A missing restaurant id or order number must yield no group at all."""
        self.assertIsNone(order_tracking_group_name(None, SHARED_ORDER_NUMBER))
        self.assertIsNone(order_tracking_group_name(self.restaurant_a.id, ""))
        self.assertIsNone(order_tracking_group_name(self.restaurant_a.id, None))

    # ---------- signal targets the right groups ----------

    def test_signal_broadcasts_to_both_tenant_scoped_groups(self):
        """Saving an order emits KDS + tracking events on the correct group names."""
        groups = _collect_group_sends(self.order_a) + _collect_group_sends(self.order_b)

        self.assertIn(f"kitchen_display_{self.restaurant_a.id}", groups)
        self.assertIn(f"kitchen_display_{self.restaurant_b.id}", groups)
        self.assertIn(
            order_tracking_group_name(self.restaurant_a.id, SHARED_ORDER_NUMBER), groups
        )
        self.assertIn(
            order_tracking_group_name(self.restaurant_b.id, SHARED_ORDER_NUMBER), groups
        )
        # The unscoped legacy group must never be used.
        self.assertNotIn(f"order_{SHARED_ORDER_NUMBER}", groups)

    # ---------- live socket isolation ----------

    def test_tenant_a_receives_own_update_and_tenant_b_does_not(self):
        """A's customer gets A's update; B's customer receives nothing."""
        communicator_a = _tracking_communicator(
            self.restaurant_a.slug, SHARED_ORDER_NUMBER, PHONE_A
        )
        communicator_b = _tracking_communicator(
            self.restaurant_b.slug, SHARED_ORDER_NUMBER, PHONE_B
        )

        async def scenario():
            try:
                connected_a, _ = await communicator_a.connect()
                connected_b, _ = await communicator_b.connect()
                self.assertTrue(connected_a, "customer A should connect")
                self.assertTrue(connected_b, "customer B should connect")

                await sync_to_async(broadcast_order_update)(
                    Order, self.order_a, created=True
                )

                received_a = await communicator_a.receive_from(timeout=2)
                leaked_b = await communicator_b.receive_nothing(timeout=1)
                return received_a, leaked_b
            finally:
                await communicator_a.disconnect()
                await communicator_b.disconnect()

        received_a, leaked_b = _run_scenario(scenario)
        payload_a = json.loads(received_a)
        self.assertEqual(payload_a["order_number"], SHARED_ORDER_NUMBER)
        self.assertEqual(payload_a["total"], "10.00")  # A's own total
        self.assertTrue(leaked_b, "tenant B must NOT receive tenant A's order update")

    def test_tenant_b_receives_own_update_and_tenant_a_does_not(self):
        """Reverse direction: B gets B's update; A receives nothing."""
        communicator_a = _tracking_communicator(
            self.restaurant_a.slug, SHARED_ORDER_NUMBER, PHONE_A
        )
        communicator_b = _tracking_communicator(
            self.restaurant_b.slug, SHARED_ORDER_NUMBER, PHONE_B
        )

        async def scenario():
            try:
                connected_a, _ = await communicator_a.connect()
                connected_b, _ = await communicator_b.connect()
                self.assertTrue(connected_a)
                self.assertTrue(connected_b)

                await sync_to_async(broadcast_order_update)(
                    Order, self.order_b, created=True
                )

                received_b = await communicator_b.receive_from(timeout=2)
                leaked_a = await communicator_a.receive_nothing(timeout=1)
                return received_b, leaked_a
            finally:
                await communicator_a.disconnect()
                await communicator_b.disconnect()

        received_b, leaked_a = _run_scenario(scenario)
        payload_b = json.loads(received_b)
        self.assertEqual(payload_b["order_number"], SHARED_ORDER_NUMBER)
        self.assertEqual(payload_b["total"], "20.00")  # B's own total
        self.assertTrue(leaked_a, "tenant A must NOT receive tenant B's order update")

    def test_same_order_number_both_tenants_get_only_their_own_update(self):
        """Both sockets stay open and each sees exactly its own tenant's update."""
        communicator_a = _tracking_communicator(
            self.restaurant_a.slug, SHARED_ORDER_NUMBER, PHONE_A
        )
        communicator_b = _tracking_communicator(
            self.restaurant_b.slug, SHARED_ORDER_NUMBER, PHONE_B
        )

        async def scenario():
            try:
                await communicator_a.connect()
                await communicator_b.connect()

                await sync_to_async(broadcast_order_update)(
                    Order, self.order_a, created=True
                )
                first_a = json.loads(await communicator_a.receive_from(timeout=2))
                nothing_b = await communicator_b.receive_nothing(timeout=1)

                await sync_to_async(broadcast_order_update)(
                    Order, self.order_b, created=True
                )
                second_b = json.loads(await communicator_b.receive_from(timeout=2))
                nothing_a = await communicator_a.receive_nothing(timeout=1)

                return first_a, nothing_b, second_b, nothing_a
            finally:
                await communicator_a.disconnect()
                await communicator_b.disconnect()

        first_a, nothing_b, second_b, nothing_a = _run_scenario(scenario)
        self.assertEqual(first_a["total"], "10.00")
        self.assertEqual(second_b["total"], "20.00")
        self.assertTrue(nothing_b, "B leaked A's update")
        self.assertTrue(nothing_a, "A leaked B's update")

    # ---------- handshake authorization ----------

    def test_cross_tenant_slug_and_phone_combination_is_rejected(self):
        """A's phone against B's order must not join B's tracking group."""
        communicator = _tracking_communicator(
            self.restaurant_b.slug, SHARED_ORDER_NUMBER, PHONE_A
        )

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected, "cross-tenant credentials must be rejected")
        self.assertEqual(code, 4004)

    def test_unknown_restaurant_slug_is_rejected(self):
        """A non-existent / inactive slug must not open a tracking group."""
        communicator = _tracking_communicator(
            "no-such-restaurant", SHARED_ORDER_NUMBER, PHONE_A
        )

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected)
        self.assertEqual(code, 4004)

    def test_missing_phone_parameter_is_rejected(self):
        """Tracking without the phone query parameter must be refused."""
        communicator = WebsocketCommunicator(
            ASGI_APPLICATION,
            f"/ws/public/{self.restaurant_a.slug}/orders/{SHARED_ORDER_NUMBER}/",
            headers=WS_HEADERS,
        )

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected)
        self.assertEqual(code, 4008)


class KDSWebSocketIsolationTests(TransactionTestCase):
    """KDS group isolation must be preserved (regression guard)."""

    def setUp(self):
        self.restaurant_a = Restaurant.objects.create(
            name="Restaurant A", slug="kds-a", is_active=True
        )
        self.restaurant_b = Restaurant.objects.create(
            name="Restaurant B", slug="kds-b", is_active=True
        )
        self.user_a = User.objects.create_user(
            username="kds_a", password="x", restaurant=self.restaurant_a
        )
        self.user_b = User.objects.create_user(
            username="kds_b", password="x", restaurant=self.restaurant_b
        )

    def test_kds_joins_only_its_own_restaurant_group(self):
        """Restaurant A's KDS socket receives A's order, not B's."""
        order_a = Order.objects.create(
            order_number="ORD-KDS-A-001",
            restaurant=self.restaurant_a,
            total=Decimal("11.00"),
            created_by=self.user_a,
        )
        order_b = Order.objects.create(
            order_number="ORD-KDS-B-001",
            restaurant=self.restaurant_b,
            total=Decimal("22.00"),
            created_by=self.user_b,
        )
        self.assertNotEqual(order_a.restaurant_id, order_b.restaurant_id)

        communicator_a = _kds_communicator(_access_token_for(self.user_a))
        communicator_b = _kds_communicator(_access_token_for(self.user_b))

        async def scenario():
            try:
                connected_a, _ = await communicator_a.connect()
                connected_b, _ = await communicator_b.connect()
                self.assertTrue(connected_a, "KDS A should connect")
                self.assertTrue(connected_b, "KDS B should connect")

                await sync_to_async(broadcast_order_update)(Order, order_a, created=True)

                received_a = await communicator_a.receive_from(timeout=2)
                leaked_b = await communicator_b.receive_nothing(timeout=1)
                return received_a, leaked_b
            finally:
                await communicator_a.disconnect()
                await communicator_b.disconnect()

        received_a, leaked_b = _run_scenario(scenario)
        self.assertEqual(json.loads(received_a)["total"], "11.00")
        self.assertTrue(leaked_b, "KDS B must not receive restaurant A's order")

    def test_kds_rejects_anonymous_connection(self):
        """No token => anonymous user => connection refused with 4003."""
        communicator = WebsocketCommunicator(
            ASGI_APPLICATION, "/ws/kds/", headers=WS_HEADERS
        )

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected)
        self.assertEqual(code, 4003)

    def test_kds_rejects_user_without_restaurant(self):
        """An authenticated user with no restaurant gets no KDS group."""
        orphan = User.objects.create_user(
            username="kds_orphan", password="x", restaurant=None
        )
        communicator = _kds_communicator(_access_token_for(orphan))

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected)
        self.assertEqual(code, 4003)

    def test_kds_rejects_inactive_user(self):
        """
        A deactivated user must not authenticate over WebSocket.

        The REST API rejects inactive users via SimpleJWT
        (CHECK_USER_IS_ACTIVE=True); WebSocket auth must not be weaker.
        """
        inactive = User.objects.create_user(
            username="kds_inactive",
            password="x",
            restaurant=self.restaurant_a,
            is_active=False,
        )
        # The token itself is cryptographically valid and unexpired.
        token = _access_token_for(inactive)
        communicator = _kds_communicator(token)

        async def scenario():
            return await communicator.connect()

        connected, code = _run_scenario(scenario)
        self.assertFalse(connected, "inactive user must not connect to the KDS")
        self.assertEqual(code, 4003)

    def test_kds_accepts_active_user_with_restaurant(self):
        """Positive control: an active user with a restaurant still connects."""
        communicator = _kds_communicator(_access_token_for(self.user_a))

        async def scenario():
            return await communicator.connect()

        connected, _ = _run_scenario(scenario)
        self.assertTrue(connected, "active user must still be able to connect")

    def test_inactive_user_token_does_not_grant_tenant_access(self):
        """
        Deactivation wins over a valid token: no tenant-scoped broadcast either.

        Guards against a regression where an inactive user is refused the KDS
        but still receives kitchen broadcasts for their former restaurant.
        """
        inactive = User.objects.create_user(
            username="kds_inactive_recv",
            password="x",
            restaurant=self.restaurant_a,
            is_active=False,
        )
        order = Order.objects.create(
            order_number="ORD-KDS-INACT-001",
            restaurant=self.restaurant_a,
            total=Decimal("33.00"),
            created_by=inactive,
        )
        communicator = _kds_communicator(_access_token_for(inactive))

        async def scenario():
            try:
                connected, code = await communicator.connect()
                await sync_to_async(broadcast_order_update)(Order, order, created=True)
                leaked = await communicator.receive_nothing(timeout=1)
                return connected, code, leaked
            finally:
                await communicator.disconnect()

        connected, code, leaked = _run_scenario(scenario)
        self.assertFalse(connected, "inactive user must not connect")
        self.assertEqual(code, 4003)
        self.assertTrue(leaked, "inactive user must not receive KDS broadcasts")

    def test_kds_group_name_is_tenant_scoped_and_not_shared(self):
        """KDS group names embed the restaurant id, so tenants never share one."""
        name_a = f"kitchen_display_{self.restaurant_a.id}"
        name_b = f"kitchen_display_{self.restaurant_b.id}"
        self.assertNotEqual(name_a, name_b)
        self.assertNotEqual(name_a, "kitchen_display")
