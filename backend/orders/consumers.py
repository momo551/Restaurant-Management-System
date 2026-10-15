import json
from channels.generic.websocket import AsyncWebsocketConsumer

from .groups import order_tracking_group_name


class KDSConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Security: reject unauthenticated WebSocket connections
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4003)
            return

        restaurant_id = getattr(user, 'restaurant_id', None)
        if not restaurant_id:
            # Reject users without restaurant assignment
            await self.close(code=4003)
            return

        self.group_name = f"kitchen_display_{restaurant_id}"

        # Join kitchen group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        # Check if the 'token' subprotocol was used
        subprotocol = None
        if 'token' in self.scope.get('subprotocols', []):
            subprotocol = 'token'

        await self.accept(subprotocol=subprotocol)


    async def disconnect(self, close_code):
        # Leave kitchen group (only if group_name was set — i.e., auth passed)
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Receive message from room group
    async def order_update(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["data"]))


class OrderTrackingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from tenants.models import Restaurant
        from .models import Order
        from asgiref.sync import sync_to_async

        self.restaurant_slug = self.scope['url_route']['kwargs']['restaurant_slug']
        self.order_number = self.scope['url_route']['kwargs']['order_number']
        
        # Get phone from query parameters
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        from urllib.parse import parse_qs
        query_params = parse_qs(query_string)
        phone = query_params.get('phone', [None])[0]

        if not phone:
            await self.close(code=4008)  # Missing phone parameter
            return

        # Validate restaurant exists and is active using sync_to_async
        try:
            restaurant = await sync_to_async(Restaurant.objects.get)(
                slug=self.restaurant_slug,
                is_active=True
            )
        except Restaurant.DoesNotExist:
            await self.close(code=4004)  # Restaurant not found
            return

        # Validate order exists, belongs to restaurant, and phone matches using sync_to_async
        try:
            order = await sync_to_async(Order.objects.get)(
                order_number=self.order_number,
                restaurant=restaurant,
                customer_phone=phone
            )
        except Order.DoesNotExist:
            await self.close(code=4004)  # Order not found or unauthorized
            return

        # Scope the group by the validated restaurant id AND the order number.
        # restaurant_id comes from the Database row matched above (never from
        # client input). Without this scope, two tenants sharing an order_number
        # would join the same group and receive each other's order updates.
        self.group_name = order_tracking_group_name(restaurant.id, self.order_number)
        if not self.group_name:
            await self.close(code=4004)
            return

        # Join the order-specific group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave the group
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    # Receive status update specifically for this order
    async def order_status_update(self, event):
        # Send message back to the customer's WebSocket
        await self.send(text_data=json.dumps(event["data"]))
