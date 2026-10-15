"""
Audit logging utilities for tracking sensitive changes in the system.
"""
from django.utils.timezone import now


def get_client_ip(request):
    """Extract client IP from request."""
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
    return None


def get_model_diff(old_data: dict, new_data: dict) -> dict:
    """
    Returns dict of changed fields: {field: {'old': ..., 'new': ...}}
    """
    diff = {}
    all_keys = set(old_data.keys()) | set(new_data.keys())
    for key in all_keys:
        old_val = old_data.get(key)
        new_val = new_data.get(key)
        if str(old_val) != str(new_val):
            diff[key] = {'old': old_val, 'new': new_val}
    return diff


def serialize_instance(instance, fields=None):
    """Serialize model instance to dict for logging."""
    from django.forms.models import model_to_dict
    data = model_to_dict(instance, fields=fields)
    # Convert non-serializable types
    for key, val in data.items():
        if hasattr(val, '__str__') and not isinstance(val, (str, int, float, bool, type(None), list, dict)):
            data[key] = str(val)
    return data


def log_action(
    user,
    action: str,
    instance=None,
    old_data: dict = None,
    new_data: dict = None,
    description: str = '',
    request=None,
    extra_data: dict = None,
):
    """
    Create an ActivityLog entry.

    Usage:
        log_action(
            user=request.user,
            action=ActivityLog.ActionType.PRICE_CHANGE,
            instance=menu_item,
            old_data={'price': '50.00'},
            new_data={'price': '65.00'},
            description=f"Price changed for {menu_item.name}",
            request=request,
        )
    """
    from users.models import ActivityLog

    try:
        ActivityLog.objects.create(
            user=user,
            action=action,
            model_name=instance.__class__.__name__ if instance else '',
            object_id=instance.pk if instance else None,
            description=description,
            old_data=old_data,
            new_data=new_data,
            extra_data=extra_data,
            ip_address=get_client_ip(request),
        )
    except Exception:
        # Never let audit logging break the main flow
        pass
