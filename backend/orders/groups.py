"""
Django Channels group naming helpers for order broadcasting.

These helpers exist so the *producer* (orders/signals.py) and the *consumer*
(orders/consumers.py) can never drift apart on group naming. A mismatch would
silently break delivery, and — worse — a group that is missing the restaurant
scope would leak order data across tenants.

Tenancy note: ``Order`` is unique on ``(restaurant, order_number)``
(see orders/models.py), which means the same ``order_number`` can legitimately
exist in two different restaurants. Group names must therefore always be scoped
by restaurant id in addition to the order number.
"""


def order_tracking_group_name(restaurant_id, order_number):
    """
    Build the channel-layer group name for a single order's tracking stream.

    Always scope by BOTH the restaurant id and the order number. The restaurant
    id must come from the database (``order.restaurant_id`` / the validated
    ``Restaurant`` row) and never from client-supplied input.

    Returns ``None`` when the order has no restaurant context, so callers can
    skip broadcasting instead of falling back to an unscoped (leaking) group.
    """
    if restaurant_id is None or order_number in (None, ""):
        return None
    return f"order_{restaurant_id}_{order_number}"
