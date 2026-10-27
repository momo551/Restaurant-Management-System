"""
Shared validation helpers for order payloads.

The discount policy lives here so that the serializer (order creation/update via
``POST/PATCH /api/orders/``) and the explicit POS edit action
(``PATCH /api/orders/<pk>/edit/``) enforce exactly the same rules, without a
circular import between ``orders.serializers`` and ``orders.views``.
"""
import math
from decimal import Decimal, InvalidOperation

# A discount is a percentage with at most two decimals in the 0..100 range.
# It mirrors the POS input (frontend/src/pages/OrderTaking.jsx: min=0, max=100,
# step=0.01) and the model column (max_digits=5, decimal_places=2).
DISCOUNT_PERCENTAGE_MAX = Decimal('100.00')
DISCOUNT_PERCENTAGE_QUANTUM = Decimal('0.01')
DISCOUNT_PERCENTAGE_DECIMALS = 2


def parse_discount_percentage(raw):
    """
    Parse and validate a client supplied ``discount_percentage``.

    Returns a ``Decimal`` quantized to two decimals, or raises ``ValueError`` with
    a user facing message. Non numeric values, booleans, NaN/Infinity, negative
    values, values above 100% and values represented with more than two decimals
    are rejected instead of leaking a 500 error from the financial calculation.
    """
    if isinstance(raw, bool) or raw is None:
        raise ValueError('نسبة الخصم يجب أن تكون رقمًا بين 0 و100.')

    if isinstance(raw, Decimal):
        value = raw
    elif isinstance(raw, float):
        if not math.isfinite(raw):
            raise ValueError('نسبة الخصم يجب أن تكون رقمًا منتهيًا (لا NaN ولا Infinity).')
        # str() avoids binary floating point artefacts (e.g. 0.1 -> '0.1').
        value = Decimal(str(raw))
    elif isinstance(raw, int):
        value = Decimal(raw)
    elif isinstance(raw, str):
        text = raw.strip()
        if not text:
            raise ValueError('نسبة الخصم مطلوبة.')
        try:
            value = Decimal(text)
        except InvalidOperation:
            raise ValueError('نسبة الخصم يجب أن تكون رقمًا صالحًا.')
    else:
        raise ValueError('نسبة الخصم يجب أن تكون رقمًا بين 0 و100.')

    if not value.is_finite():
        raise ValueError('نسبة الخصم يجب أن تكون رقمًا منتهيًا (لا NaN ولا Infinity).')

    if value < 0:
        raise ValueError('نسبة الخصم لا يمكن أن تكون سالبة.')

    if value > DISCOUNT_PERCENTAGE_MAX:
        raise ValueError('نسبة الخصم لا يمكن أن تتجاوز 100%.')

    # Reject more than two *represented* decimals (e.g. 12.345 or 12.500). This is
    # the same rule as DRF's DecimalField(decimal_places=2) used on the serializer,
    # so the create and edit endpoints accept exactly the same payloads.
    exponent = value.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -DISCOUNT_PERCENTAGE_DECIMALS:
        raise ValueError('نسبة الخصم يجب ألا تحتوي على أكثر من رقمين عشريين.')

    try:
        return value.quantize(DISCOUNT_PERCENTAGE_QUANTUM)
    except InvalidOperation:
        raise ValueError('نسبة الخصم غير صالحة.')
