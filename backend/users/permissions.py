from rest_framework import permissions

from .models import ModulePermission

# Legacy mapping for compatibility with existing HasXXXAccess classes
LEGACY_MODULE_MAPPING = {
    'pos': 'pos',
    'tables': 'tables',
    'reports': 'reports',
    'dashboard': 'dashboard',
    'menu': 'menu',
    'delivery': 'delivery_monitor',
    'kitchen': 'orders',
    'staff': 'staff',
    'stock': 'ingredients',
}

def get_user_restaurant(user):
    """Helper to get user's assigned restaurant, or None."""
    if not user or not user.is_authenticated:
        return None
    return getattr(user, 'restaurant', None)


class BaseRolePermission(permissions.BasePermission):
    """Base class for role-based permissions using MODULE_PERMISSIONS."""
    module_name = None

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        
        if request.user.is_superuser or request.user.role == 'owner':
            return True
        
        if not self.module_name:
            return False
            
        # Try to get dynamic permission from database scoped to user's restaurant
        module_key = LEGACY_MODULE_MAPPING.get(self.module_name, self.module_name)
        restaurant = get_user_restaurant(request.user)
        qs = ModulePermission.objects.filter(
            role=request.user.role, 
            module_key=module_key, 
            allowed=True
        )
        if restaurant:
            rest_perm = qs.filter(restaurant=restaurant)
            if rest_perm.exists():
                return True
            return qs.filter(restaurant__isnull=True).exists()
        return qs.exists()



class IsOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'owner'

class IsOwnerOrSelf(permissions.BasePermission):
    """
    Allows access to owners, authorized staff managers (for staff in the same restaurant),
    and self (for own profile). Enforces strict tenant boundaries.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_rest_id = getattr(request.user, 'restaurant_id', None)
        obj_rest_id = getattr(obj, 'restaurant_id', None)

        # Cross-tenant access is strictly forbidden
        if user_rest_id and obj_rest_id and user_rest_id != obj_rest_id:
            return False

        # Owner of the same restaurant has object permission
        if request.user.role == 'owner' and (not user_rest_id or user_rest_id == obj_rest_id):
            return True

        # User modifying or retrieving their own profile
        if obj.id == request.user.id:
            return True

        # Staff manager / HR with staff permissions accessing staff within their own restaurant
        if request.user.role:
            has_staff = ModulePermission.objects.filter(
                role=request.user.role,
                module_key='staff',
                allowed=True
            ).exists()
            if has_staff and user_rest_id == obj_rest_id:
                # Non-owners cannot modify or access owner accounts
                if getattr(obj, 'role', None) == 'owner':
                    return False
                return True

        return False


class HasPOSAccess(BaseRolePermission):
    module_name = 'pos'

class HasTablesAccess(BaseRolePermission):
    module_name = 'tables'

class HasReportsAccess(BaseRolePermission):
    module_name = 'reports'

class HasDashboardAccess(BaseRolePermission):
    module_name = 'dashboard'

class HasMenuAccess(BaseRolePermission):
    module_name = 'menu'

class HasDeliveryAccess(BaseRolePermission):
    module_name = 'delivery'

class HasKitchenAccess(BaseRolePermission):
    module_name = 'kitchen'

class HasStaffAccess(BaseRolePermission):
    module_name = 'staff'

class HasStockAccess(BaseRolePermission):
    module_name = 'stock'

class HasAuditLogAccess(BaseRolePermission):
    module_name = 'audit_log'

class HasPermissionsMatrixAccess(BaseRolePermission):
    module_name = 'permissions_matrix'

# Legacy support for old permission names to avoid breaking imports immediately
class IsManagerOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['owner', 'manager', 'hall_manager']

class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['owner', 'manager', 'cashier', 'kitchen', 'delivery', 'hall_manager', 'hall_captain', 'hr']

class IsInventoryManager(permissions.BasePermission):
    """
    Allows access to inventory managers or the owner.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            (request.user.role in ['owner', 'inventory_manager'])
        )

