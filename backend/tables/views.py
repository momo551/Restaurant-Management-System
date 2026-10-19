from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Table, Reservation, QRCode, TableSession
from .serializers import TableSerializer, ReservationSerializer, QRCodeSerializer, TableSessionSerializer
from users.permissions import HasTablesAccess
from rest_framework import permissions
import logging

logger = logging.getLogger(__name__)



class TableViewSet(viewsets.ModelViewSet):
    """ViewSet for Table management."""
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [HasTablesAccess]
    filterset_fields = ['status', 'floor', 'is_active']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Table.objects.none()
        if user.is_superuser:
            return Table.objects.all()
        if user.restaurant_id:
            return Table.objects.filter(restaurant_id=user.restaurant_id)
        return Table.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser and getattr(user, 'restaurant', None):
            serializer.save(restaurant=user.restaurant)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.is_superuser:
            if instance.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        super().perform_destroy(instance)

    def get_permissions(self):
        if self.action == 'from_qr':
            return [permissions.AllowAny()]
        return [HasTablesAccess()]

    @action(detail=False, methods=['get'], url_path='from-qr/(?P<code>[^/.]+)')
    def from_qr(self, request, code=None):
        """Get table info from QR code UUID."""
        try:
            qr = QRCode.objects.select_related('table__restaurant').get(code=code, is_active=True)
            if not qr.table.restaurant or not qr.table.restaurant.is_active:
                return Response({'error': 'المطعم غير متاح'}, status=status.HTTP_404_NOT_FOUND)
            data = TableSerializer(qr.table).data
            # Existing QR codes contain only the table code. Resolve their tenant
            # server-side, then let the client enter the slug-scoped public route.
            data['restaurant_slug'] = qr.table.restaurant.slug
            return Response(data)
        except QRCode.DoesNotExist:
            return Response({'error': 'كود غير صحيح'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update table status."""
        table = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Table.Status.choices):
            table.status = new_status
            table.save()
            return Response(TableSerializer(table).data)
        return Response({'error': 'حالة غير صحيحة'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_position(self, request, pk=None):
        """Update table position for visual layout."""
        table = self.get_object()
        table.position_x = request.data.get('position_x', table.position_x)
        table.position_y = request.data.get('position_y', table.position_y)
        table.save()
        return Response(TableSerializer(table).data)

    @action(detail=False, methods=['get'])
    def layout(self, request):
        """Get tables layout for visual representation."""
        floor = request.query_params.get('floor', 1)
        tables = self.get_queryset().filter(floor=floor, is_active=True)
        serializer = TableSerializer(tables, many=True)
        return Response(serializer.data)


class ReservationViewSet(viewsets.ModelViewSet):
    """ViewSet for Reservation management."""
    queryset = Reservation.objects.select_related('table')
    serializer_class = ReservationSerializer
    permission_classes = [HasTablesAccess]
    filterset_fields = ['table', 'is_confirmed', 'reservation_time']

    def get_queryset(self):
        user = self.request.user
        qs = Reservation.objects.select_related('table')
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(table__restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.table.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    def get_permissions(self):
        return [HasTablesAccess()]

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a reservation."""
        reservation = self.get_object()
        reservation.is_confirmed = True
        reservation.table.status = Table.Status.RESERVED
        reservation.table.save()
        reservation.save()
        return Response(ReservationSerializer(reservation).data)


class TableSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for Table Session management."""
    queryset = TableSession.objects.all()
    serializer_class = TableSessionSerializer
    permission_classes = [HasTablesAccess]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return TableSession.objects.none()
        if user.is_superuser:
            return TableSession.objects.all()
        if user.restaurant_id:
            return TableSession.objects.filter(table__restaurant_id=user.restaurant_id)
        return TableSession.objects.none()

    def get_permissions(self):
        if self.action == 'create_session':
            return [permissions.AllowAny()]
        return [HasTablesAccess()]

    def perform_update(self, serializer):
        instance = self.get_object()
        if not self.request.user.is_superuser:
            if instance.table.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot modify data belonging to another restaurant.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.is_superuser:
            if instance.table.restaurant_id != self.request.user.restaurant_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot delete data belonging to another restaurant.")
        super().perform_destroy(instance)

    @action(detail=False, methods=['post'])
    def create_session(self, request):
        """Create a new session for a table."""
        try:
            table_id = request.data.get('table_id')
            restaurant_slug = request.data.get('restaurant_slug')
            
            # For authenticated users, use their restaurant (reject client-provided slug)
            if request.user and request.user.is_authenticated and not request.user.is_superuser:
                if restaurant_slug:
                    # Authenticated user cannot override their restaurant via slug
                    return Response({'error': 'المطعم محدد من المستخدم المصادق'}, status=status.HTTP_400_BAD_REQUEST)
                table = Table.objects.get(id=table_id, restaurant=request.user.restaurant, is_active=True)
            # For public access, use restaurant slug if provided
            elif restaurant_slug:
                from tenants.models import Restaurant
                restaurant = Restaurant.objects.get(slug=restaurant_slug, is_active=True)
                table = Table.objects.get(id=table_id, restaurant=restaurant, is_active=True)
            else:
                return Response({'error': 'المطعم غير محدد'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Find or create an active session for this table
            session = TableSession.objects.filter(table=table, is_active=True).first()
            if not session:
                session = TableSession.objects.create(table=table)
            return Response(TableSessionSerializer(session).data)
        except Table.DoesNotExist:
            return Response({'error': 'الطاولة غير موجودة'}, status=status.HTTP_404_NOT_FOUND)
        except Restaurant.DoesNotExist:
            return Response({'error': 'المطعم غير موجود'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception("Unexpected error while creating table session")
            return Response({'error': 'حدث خطأ غير متوقع'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


