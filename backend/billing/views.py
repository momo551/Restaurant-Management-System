from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from .models import Invoice, Refund
from orders.models import Order, OrderAuditLog
from .serializers import InvoiceSerializer
from users.permissions import HasPOSAccess


class InvoiceViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.filter(is_deleted=False).select_related('order')
        if not user or not user.is_authenticated:
            return qs
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(order__restaurant_id=user.restaurant_id)
        return qs.none()

    def perform_create(self, serializer):
        if not self.request.user.is_superuser and hasattr(self.request.user, 'restaurant') and self.request.user.restaurant:
            if serializer.validated_data.get('order'):
                if serializer.validated_data['order'].restaurant_id != self.request.user.restaurant.id:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("Cannot create invoice for order from another restaurant.")
        serializer.save()

    def perform_update(self, serializer):
        if not self.request.user.is_superuser and hasattr(self.request.user, 'restaurant') and self.request.user.restaurant:
            if serializer.instance.order.restaurant_id != self.request.user.restaurant.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Cannot modify invoice from another restaurant.")
        serializer.save()

    serializer_class = InvoiceSerializer
    permission_classes = [HasPOSAccess]


    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """Endpoint to get simplified data for thermal printing."""
        invoice = self.get_object()
        restaurant_name = 'My Restaurant'
        if invoice.order and invoice.order.restaurant:
            restaurant_name = invoice.order.restaurant.name
        return Response({
            'restaurant_name': restaurant_name,
            'invoice_no': invoice.invoice_number,
            'date': invoice.created_at.strftime('%Y-%m-%d %H:%M'),
            'items': [
                {'name': item.menu_item.name, 'qty': item.quantity, 'price': str(item.unit_price)}
                for item in invoice.order.items.all()
            ],
            'subtotal': str(invoice.subtotal),
            'tax': str(invoice.tax_amount),
            'service': str(invoice.service_charge),
            'discount': str(invoice.discount_amount),
            'total': str(invoice.total_amount)
        })

    @action(detail=True, methods=['delete'])
    def delete_invoice(self, request, pk=None):
        """Soft delete an unpaid invoice with specific role constraints."""
        invoice = self.get_object()
        user_role = request.user.role

        if invoice.is_deleted:
            return Response({'error': 'الفاتورة محذوفة بالفعل'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Status Rules
        if invoice.is_paid:
            return Response({'error': 'لا يمكن حذف فاتورة مدفوعة، يرجى استخدام الاسترجاع'}, status=status.HTTP_403_FORBIDDEN)

        # 2. Role Rules
        # Cashier, Hall Captain never allowed to delete invoices independently
        allowed_roles = ['manager', 'owner']
        if user_role not in allowed_roles:
            return Response({'error': 'ليس لديك صلاحية لحذف الفواتير'}, status=status.HTTP_403_FORBIDDEN)

        # 3. Perform Soft Delete
        with transaction.atomic():
            invoice.is_deleted = True
            invoice.deleted_at = timezone.now()
            invoice.deleted_by = request.user
            invoice.save()
            
            # Revert order to pending
            if hasattr(invoice, 'order'):
                order = invoice.order
                order.status = Order.Status.PENDING
                order.save()
                
                # Log the change
                OrderAuditLog.objects.create(
                    order=order,
                    user=request.user,
                    action=OrderAuditLog.ActionType.EDIT,
                    data_before={'status': 'Various', 'invoice_id': invoice.id},
                    data_after={'status': order.status, 'invoice_id': None, 'note': 'Invoice Deleted'}
                )

        return Response({'message': 'تم حذف الفاتورة بنجاح'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def refund_invoice(self, request, pk=None):
        """Refund a paid invoice."""
        invoice = self.get_object()
        user_role = request.user.role

        if invoice.is_deleted:
             return Response({'error': 'لا يمكن استرجاع فاتورة محذوفة'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.is_refunded:
            return Response({'error': 'هذه الفاتورة تم استرجاعها من قبل'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Status Rules
        if not invoice.is_paid:
            return Response({'error': 'لا يمكن استرجاع فاتورة غير مدفوعة'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Role Rules
        allowed_roles = ['manager', 'owner']
        if user_role not in allowed_roles:
            return Response({'error': 'ليس لديك صلاحية لعمل استرجاع'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason', '')
        if not reason:
             return Response({'error': 'يجب توضيح سبب الاسترجاع'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create Refund Record
            Refund.objects.create(
                invoice=invoice,
                amount=invoice.total_amount,
                reason=reason,
                created_by=request.user
            )

            # Mark Invoice as refunded
            invoice.is_refunded = True
            invoice.refunded_at = timezone.now()
            invoice.save()
            
            # Revert Order status (or maybe set it to cancelled depending on business logic, here going to cancelled)
            if hasattr(invoice, 'order'):
                order = invoice.order
                from orders.serializers import OrderSerializer
                data_before = OrderSerializer(order).data
                
                order.status = Order.Status.CANCELLED
                
                if order.table:
                    # check if other active orders exist
                    active_orders = Order.objects.filter(table=order.table, is_deleted=False).exclude(id=order.id).exists()
                    if not active_orders:
                        order.table.status = 'available'
                        order.table.save()
                        
                order.save()

                OrderAuditLog.objects.create(
                    order=order,
                    user=request.user,
                    action=OrderAuditLog.ActionType.EDIT,
                    data_before=data_before,
                    data_after=OrderSerializer(order).data
                )

        return Response({'message': 'تم استرجاع الفاتورة بنجاح'}, status=status.HTTP_200_OK)
