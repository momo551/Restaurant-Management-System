from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, ActivityLog, ModulePermission



class ModulePermissionSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = ModulePermission
        fields = ['id', 'restaurant', 'role', 'role_display', 'module_key', 'module_label', 'allowed']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=False)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'password_confirm', 'first_name', 'last_name',
            'role', 'role_display', 'restaurant', 'restaurant_name', 'phone', 'monthly_target', 'base_salary',
            'delivery_commission_rate', 'total_commissions', 'is_active', 
            'created_at', 'updated_at', 'permissions'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'restaurant_name', 'restaurant']

    def to_internal_value(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if not request.user.is_superuser:
                for forbidden in ['is_staff', 'is_superuser']:
                    if forbidden in data:
                        raise serializers.ValidationError({
                            forbidden: f'لا يمكن تعديل الحقل {forbidden} من خلال الواجهة'
                        })
        return super().to_internal_value(data)

    def get_permissions(self, obj):
        if obj.restaurant_id:
            perms = ModulePermission.objects.filter(role=obj.role, restaurant=obj.restaurant)
            if not perms.exists():
                perms = ModulePermission.objects.filter(role=obj.role, restaurant__isnull=True)
        else:
            perms = ModulePermission.objects.filter(role=obj.role)
        return {p.module_key: p.allowed for p in perms}

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')
        
        if password or password_confirm:
            if password != password_confirm:
                raise serializers.ValidationError({'password_confirm': 'كلمات المرور غير متطابقة'})

        request = self.context.get('request')
        instance = self.instance

        if request and hasattr(request, 'user') and request.user.is_authenticated:
            req_user = request.user
            is_super = bool(req_user.is_superuser)
            is_owner = (getattr(req_user, 'role', None) == User.Role.OWNER) or is_super
            is_self = instance is not None and instance.id == req_user.id

            # 1. Block privilege flags modification via API
            if 'is_staff' in attrs and not is_super:
                raise serializers.ValidationError({'is_staff': 'لا يمكن تعديل صلاحيات الإدارة العليا'})
            if 'is_superuser' in attrs and not is_super:
                raise serializers.ValidationError({'is_superuser': 'لا يمكن تعديل صلاحيات المدير العام'})

            # 2. Block self-escalation and self-compensation changes
            restricted_self_fields = [
                'role', 'is_active', 'base_salary', 'monthly_target',
                'delivery_commission_rate', 'total_commissions', 'restaurant'
            ]
            if is_self and not is_super:
                for field in restricted_self_fields:
                    if field in attrs:
                        if getattr(instance, field, None) != attrs[field]:
                            raise serializers.ValidationError({field: f'لا يمكنك تعديل الحقل {field} لحسابك الخاص'})

            # 3. Role modification restrictions on other users
            if 'role' in attrs and instance is not None:
                new_role = attrs['role']
                if new_role != instance.role:
                    if is_self and not is_super:
                        raise serializers.ValidationError({'role': 'لا يمكنك تغيير دورك الخاص'})
                    # Only owner or superuser can assign the 'owner' role
                    if new_role == User.Role.OWNER and not is_owner:
                        raise serializers.ValidationError({'role': 'فقط مالك المطعم يمكنه تعيين دور المالك'})
                    # Non-owners must have staff management permission
                    if not is_owner:
                        has_staff = ModulePermission.objects.filter(
                            role=req_user.role,
                            module_key='staff',
                            allowed=True
                        ).exists()
                        if not has_staff:
                            raise serializers.ValidationError({'role': 'ليس لديك صلاحية لتعديل الأدوار'})

            # 4. Prevent non-owners from modifying owner accounts
            if instance and instance.role == User.Role.OWNER and not is_self:
                if not is_owner:
                    raise serializers.ValidationError({'detail': 'لا يمكن لغير المالك تعديل بيانات حساب المالك'})

            # 5. Prevent tenant cross-boundary mutation
            if 'restaurant' in attrs:
                if instance and attrs['restaurant'] != instance.restaurant and not is_super:
                    raise serializers.ValidationError({'restaurant': 'لا يمكن تغيير مطعم المستخدم'})

        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        validated_data.pop('password_confirm', None)
        
        request = self.context.get('request')
        is_super = bool(request and request.user and request.user.is_superuser)

        # Strip unprivileged access to sensitive fields
        if not is_super:
            validated_data.pop('is_staff', None)
            validated_data.pop('is_superuser', None)
            validated_data.pop('restaurant', None)
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        if password:
            instance.set_password(password)
            
        instance.save()
        return instance

    def validate_username(self, value):
        user = self.instance
        if user and user.username != value:
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                if not request.user.is_superuser and getattr(request.user, 'role', None) != User.Role.OWNER:
                    raise serializers.ValidationError('فقط مالك المطعم يمكنه تغيير اسم المستخدم')
        return value


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'restaurant', 'phone', 
            'monthly_target', 'base_salary', 'delivery_commission_rate'
        ]
        read_only_fields = ['id', 'restaurant']

    def to_internal_value(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if not request.user.is_superuser:
                for forbidden in ['is_staff', 'is_superuser']:
                    if forbidden in data:
                        raise serializers.ValidationError({
                            forbidden: f'لا يمكن تمرير الحقل {forbidden} عند إنشاء المستخدم'
                        })
        return super().to_internal_value(data)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'كلمات المرور غير متطابقة'})
            
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            req_user = request.user
            is_super = bool(req_user.is_superuser)
            is_owner = (getattr(req_user, 'role', None) == User.Role.OWNER) or is_super
            
            # Only owner or superuser can create another owner
            if attrs.get('role') == User.Role.OWNER and not is_owner:
                raise serializers.ValidationError({'role': 'فقط مالك المطعم يمكنه إنشاء حساب مالك'})
                
            # Disallow is_staff and is_superuser creation via API
            if attrs.get('is_staff') and not is_super:
                raise serializers.ValidationError({'is_staff': 'لا يمكن إنشاء مستخدم بصلاحيات إدارة'})
            if attrs.get('is_superuser') and not is_super:
                raise serializers.ValidationError({'is_superuser': 'لا يمكن إنشاء مستخدم بصلاحيات سوبر أدمن'})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        # If restaurant not explicitly provided, use current requesting user's restaurant
        request = self.context.get('request')
        if not validated_data.get('restaurant') and request and hasattr(request.user, 'restaurant'):
            validated_data['restaurant'] = request.user.restaurant
            
        # Strip is_staff and is_superuser if request is not superuser
        if request and hasattr(request, 'user') and not request.user.is_superuser:
            validated_data.pop('is_staff', None)
            validated_data.pop('is_superuser', None)

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('كلمة المرور الحالية غير صحيحة')
        return value


class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for Activity Log."""
    user_name = serializers.CharField(source='user.username', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user', 'user_name', 'action', 'action_display',
            'model_name', 'object_id', 'description',
            'old_data', 'new_data', 'ip_address', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer to include role, restaurant and user info."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['role'] = user.role
        token['username'] = user.username
        token['is_superuser'] = user.is_superuser
        token['restaurant_id'] = user.restaurant_id
        token['restaurant_name'] = user.restaurant.name if user.restaurant else None
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role,
            'role_display': self.user.get_role_display(),
            'restaurant_id': self.user.restaurant_id,
            'restaurant_name': self.user.restaurant.name if self.user.restaurant else None,
            'is_superuser': self.user.is_superuser,
        }
        return data

