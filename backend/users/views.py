from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import ActivityLog, ModulePermission
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import (
    UserSerializer, UserCreateSerializer, 
    ChangePasswordSerializer, ActivityLogSerializer,
    CustomTokenObtainPairSerializer, ModulePermissionSerializer
)

class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT view to use the custom serializer."""
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]

from .permissions import (
    IsOwner, IsOwnerOrSelf, IsManagerOrAbove, IsStaff,
    HasAuditLogAccess, HasPermissionsMatrixAccess
)
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.settings import api_settings


User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management."""
    queryset = User.objects.all()
    
    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()
        if user.is_superuser:
            return User.objects.all()
        if user.restaurant_id:
            return User.objects.filter(restaurant_id=user.restaurant_id)
        return User.objects.filter(id=user.id)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()
    
    def perform_destroy(self, instance):
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'لا يمكنك حذف حسابك الخاص'})
        super().perform_destroy(instance)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        from .permissions import HasStaffAccess
        if self.action in ['list', 'create', 'staff_report', 'staff_stats']:
            return [HasStaffAccess()]
        elif self.action == 'destroy':
            return [IsOwner()]
        elif self.action in ['retrieve', 'update', 'partial_update']:
            return [IsOwnerOrSelf()]
        elif self.action == 'active_staff':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]


    @action(detail=False, methods=['get'])
    def active_staff(self, request):
        """Get a minimal list of all active staff members for operational use."""
        users = self.get_queryset().filter(is_active=True).only('id', 'username', 'first_name', 'last_name', 'role')
        data = [{
            'id': user.id,
            'name': user.get_full_name() or user.username,
            'role': user.role,
            'role_display': user.get_role_display()
        } for user in users]
        return Response(data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change current user password."""
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data['new_password'])
            request.user.save()
            return Response({'message': 'تم تغيير كلمة المرور بنجاح'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], permission_classes=[IsStaff])
    def staff_stats(self, request):
        """Get staff statistics."""
        from orders.models import Order
        from django.db.models import Count
        
        stats = []
        for user in self.get_queryset().filter(is_active=True):
            order_count = Order.objects.filter(created_by=user).count()
            last_log = ActivityLog.objects.filter(user=user).order_by('-created_at').first()
            last_activity = last_log.created_at.isoformat() if last_log else None
            
            stats.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'name': user.get_full_name() or user.username,
                'role': user.role,
                'role_display': user.get_role_display(),
                'phone': user.phone,
                'order_count': order_count,
                'monthly_target': user.monthly_target,
                'base_salary': user.base_salary,
                'total_commissions': user.total_commissions,
                'last_activity': last_activity,
                'is_active': user.is_active
            })
        return Response(stats)

    @action(detail=True, methods=['get'], permission_classes=[IsOwner])
    def staff_report(self, request, pk=None):
        """Get detailed activity report for a specific staff member."""
        from orders.models import Order
        from orders.serializers import OrderSerializer
        from django.db.models import Sum
        from django.utils import timezone
        
        user = self.get_object()
        
        # Get user's restaurant for tenant filtering
        user_restaurant = getattr(user, 'restaurant', None)
        
        # Monthly sales - add restaurant filtering
        first_day_of_month = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_orders_qs = Order.objects.filter(
            created_by=user,
            created_at__gte=first_day_of_month,
            status='paid'
        )
        if user_restaurant:
            monthly_orders_qs = monthly_orders_qs.filter(restaurant=user_restaurant)
        
        monthly_sales = monthly_orders_qs.aggregate(Sum('total'))['total__sum'] or 0
        
        # Target achievement
        target = user.monthly_target
        achievement_percent = (monthly_sales / target * 100) if target > 0 else 0
        
        # All orders by this user - add restaurant filtering
        orders_qs = Order.objects.filter(created_by=user)
        if user_restaurant:
            orders_qs = orders_qs.filter(restaurant=user_restaurant)
        
        orders = orders_qs.order_by('-created_at')
        orders_serializer = OrderSerializer(orders, many=True)
        
        return Response({
            'user': UserSerializer(user).data,
            'stats': {
                'monthly_sales': monthly_sales,
                'monthly_target': target,
                'achievement_percent': round(achievement_percent, 2),
                'total_orders': orders.count(),
                'pending_orders': orders.exclude(status__in=['paid', 'cancelled']).count(),
            },
            'orders': orders_serializer.data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def force_reset_password(self, request, pk=None):
        """Force reset password for a specific user. Only accessible by Owner."""
        user = self.get_object()
        password = request.data.get('password')
        password_confirm = request.data.get('password_confirm')
        
        if not password or not password_confirm:
            return Response({'error': 'كلمة المرور وتأكيدها مطلبان'}, status=status.HTTP_400_BAD_REQUEST)
        
        if password != password_confirm:
            return Response({'error': 'كلمات المرور غير متطابقة'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from django.contrib.auth.password_validation import validate_password
            validate_password(password, user)
            user.set_password(password)
            user.save()
            return Response({'message': 'تم إعادة تعيين كلمة المرور بنجاح'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing Activity Logs with filtering and CSV export."""
    queryset = ActivityLog.objects.select_related('user').order_by('-created_at')
    serializer_class = ActivityLogSerializer
    permission_classes = [HasAuditLogAccess]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return ActivityLog.objects.none()
        
        if user.is_superuser:
            qs = ActivityLog.objects.select_related('user').order_by('-created_at')
        elif user.restaurant_id:
            qs = ActivityLog.objects.filter(user__restaurant_id=user.restaurant_id).select_related('user').order_by('-created_at')
        else:
            qs = ActivityLog.objects.filter(user=user).select_related('user').order_by('-created_at')

        user_id = self.request.query_params.get('user')
        action = self.request.query_params.get('action')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        model_name = self.request.query_params.get('model_name')

        if user_id:
            qs = qs.filter(user_id=user_id)
        if action:
            qs = qs.filter(action=action)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if model_name:
            qs = qs.filter(model_name__icontains=model_name)
        return qs

    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Export the audit log as a PDF file with Arabic support."""
        from django.http import HttpResponse
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import arabic_reshaper
        from bidi.algorithm import get_display
        import os

        # Filter the queryset
        qs = self.get_queryset()[:500]

        # Prepare Response
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="audit_log.pdf"'

        # Setup PDF document
        doc = SimpleDocTemplate(response, pagesize=landscape(A4), rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20)
        elements = []

        # Font setup (Arabic support)
        font_path = r'C:\Windows\Fonts\arial.ttf'
        font_name = 'Arial-Arabic'
        pdfmetrics.registerFont(TTFont(font_name, font_path))

        def process_arabic(text):
            if not text: return ""
            reshaped_text = arabic_reshaper.reshape(str(text))
            bidi_text = get_display(reshaped_text)
            return bidi_text

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ArabicTitle',
            parent=styles['Heading1'],
            fontName=font_name,
            fontSize=18,
            alignment=1, # Center
            spaceAfter=20
        )

        elements.append(Paragraph(process_arabic("سجل المراجعة والتدقيق"), title_style))

        # Table Data
        data = [[
            process_arabic("عنوان IP"),
            process_arabic("الوصف"),
            process_arabic("النموذج"),
            process_arabic("الإجراء"),
            process_arabic("المستخدم"),
            process_arabic("التاريخ")
        ]]

        for log in qs:
            data.append([
                process_arabic(log.ip_address) or "",
                process_arabic(log.description),
                process_arabic(log.model_name),
                process_arabic(log.get_action_display()),
                process_arabic(str(log.user)) if log.user else "",
                process_arabic(log.created_at.strftime('%Y-%m-%d %H:%M:%S'))
            ])

        # Create Table
        table = Table(data, colWidths=[80, 250, 100, 80, 100, 120])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        elements.append(table)
        doc.build(elements)
        return response


from rest_framework.views import APIView

class LogoutView(APIView):
    """
    Secure Logout APIView that blacklists the caller's refresh token.

    The endpoint is idempotent: a missing, malformed, expired or already
    blacklisted token is answered with the same success response because there is
    nothing left to revoke. A refresh token that belongs to another user is
    refused without touching it, and no internal exception text is ever returned.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not isinstance(refresh_token, str) or not refresh_token:
            return Response({"message": "Logged out"}, status=status.HTTP_200_OK)

        try:
            token = RefreshToken(refresh_token)
        except TokenError:
            # Invalid, expired or already blacklisted: nothing left to revoke.
            # The exception text is deliberately not echoed back to the client.
            return Response({"message": "Logged out"}, status=status.HTTP_200_OK)

        # Being authenticated is not proof of owning this refresh token: a user
        # must never be able to blacklist somebody else's session.
        if str(token.get(api_settings.USER_ID_CLAIM)) != str(request.user.id):
            return Response(
                {"detail": "Refresh token does not belong to this user."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token.blacklist()
        return Response({"message": "Logged out"}, status=status.HTTP_200_OK)

class ModulePermissionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing role-based module permissions."""
    queryset = ModulePermission.objects.all()
    serializer_class = ModulePermissionSerializer
    permission_classes = [HasPermissionsMatrixAccess]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return ModulePermission.objects.none()
        if user.is_superuser:
            return ModulePermission.objects.all().order_by('module_label', 'role')
        if user.restaurant_id:
            return ModulePermission.objects.filter(restaurant_id=user.restaurant_id).order_by('module_label', 'role')
        return ModulePermission.objects.filter(restaurant__isnull=True).order_by('module_label', 'role')

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        role = request.data.get('role')
        module_key = request.data.get('module_key')
        allowed = request.data.get('allowed')
        
        if role == 'owner':
            return Response({'error': 'لا يمكن تعديل صلاحيات المالك'}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = getattr(request.user, 'restaurant', None)
        perm, created = ModulePermission.objects.update_or_create(
            restaurant=restaurant,
            role=role,
            module_key=module_key,
            defaults={'allowed': allowed}
        )
        return Response(ModulePermissionSerializer(perm).data)
