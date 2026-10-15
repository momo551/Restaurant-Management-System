import os
import django
import sys
from decimal import Decimal

# Setup Django environment
sys.path.append(r"C:\Users\Admin\Desktop\Restaurant Management System\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import uuid
from unittest.mock import patch
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model
from orders.models import Order, OrderItem, OrderAuditLog
from orders.views import OrderViewSet
from billing.models import Invoice, Refund
from billing.views import InvoiceViewSet
from menu.models import MenuItem, Category

User = get_user_model()

def create_users():
    owner, _ = User.objects.get_or_create(username='test_owner', defaults={'role': 'owner'})
    manager, _ = User.objects.get_or_create(username='test_manager', defaults={'role': 'manager'})
    cashier, _ = User.objects.get_or_create(username='test_cashier', defaults={'role': 'cashier'})
    return owner, manager, cashier

def run_tests():
    owner, manager, cashier = create_users()
    factory = APIRequestFactory()
    
    # Create test menu items
    cat, _ = Category.objects.get_or_create(name='Test Category')
    item1, _ = MenuItem.objects.get_or_create(name='Item 1', defaults={'price': 100, 'category': cat})
    item2, _ = MenuItem.objects.get_or_create(name='Item 2', defaults={'price': 50, 'category': cat})
    
    # ---------------------------------------------------------
    # Test 1: Totals recalculate correctly on Edit (Owner)
    # ---------------------------------------------------------
    print("\n[Test 1] Totals recalculate on Edit:")
    unique_suffix = str(uuid.uuid4())[:8]
    order = Order.objects.create(order_number=f'TEST-{unique_suffix}-1', order_type='dine_in', status='pending')
    OrderItem.objects.create(order=order, menu_item=item1, quantity=1, unit_price=100)
    order.update_total()
    
    request = factory.patch(f'/api/orders/{order.id}/edit/', {
        'items': [
            {'menu_item': item1.id, 'quantity': 2}
        ]
    }, format='json')
    force_authenticate(request, user=owner)
    view = OrderViewSet.as_view({'patch': 'edit'}, permission_classes=[])
    response = view(request, pk=order.pk)
    
    order.refresh_from_db()
    if order.total == 200 and response.status_code == 200:
        print("✅ Success: Total recalculated correctly (200)")
    else:
        print(f"❌ Failed: Total is {order.total}, Expected 200, Status: {response.status_code}")
        
    audit = OrderAuditLog.objects.filter(order=order).last()
    if audit and audit.action == 'edit':
        print("✅ Success: Audit log created for Edit")
    else:
        print("❌ Failed: Audit log missing")

    # ---------------------------------------------------------
    # Test 2: Cashier cannot delete orders
    # ---------------------------------------------------------
    print("\n[Test 2] RBAC - Cashier Delete Order:")
    request = factory.delete(f'/api/orders/{order.id}/delete_order/')
    force_authenticate(request, user=cashier)
    view = OrderViewSet.as_view({'delete': 'delete_order'}, permission_classes=[])
    response = view(request, pk=order.pk)
    
    if response.status_code == 403:
        print("✅ Success: Cashier explicitly denied deletion (403)")
    else:
        print(f"❌ Failed: Cashier got status {response.status_code}")

    # ---------------------------------------------------------
    # Test 3: Manager can delete pending orders
    # ---------------------------------------------------------
    print("\n[Test 3] RBAC - Manager Delete Pending Order:")
    request = factory.delete(f'/api/orders/{order.id}/delete_order/')
    force_authenticate(request, user=manager)
    view_manager_delete = OrderViewSet.as_view({'delete': 'delete_order'})
    with patch.object(OrderViewSet, 'get_permissions', return_value=[]):
        response = view_manager_delete(request, pk=order.pk)
    
    order.refresh_from_db()
    if response.status_code == 200 and order.is_deleted:
        print("✅ Success: Manager deleted pending order successfully")
    else:
        print(f"❌ Failed: Manager could not delete order. Status: {response.status_code}")

    # Setup for Invoice tests
    unique_suffix2 = str(uuid.uuid4())[:8]
    order2 = Order.objects.create(order_number=f'TEST-{unique_suffix2}-2', order_type='dine_in', status='served')
    OrderItem.objects.create(order=order2, menu_item=item1, quantity=1, unit_price=100)
    order2.update_total()
    invoice = Invoice.objects.create(order=order2, invoice_number=f'INV-TEST-{unique_suffix2}', subtotal=100)
    
    # ---------------------------------------------------------
    # Test 4: Manager cannot delete PAID invoice but can REFUND
    # ---------------------------------------------------------
    print("\n[Test 4] RBAC - Invoice Deletion & Refund:")
    invoice.is_paid = True
    invoice.save()
    order2.status = 'paid'
    order2.save()
    
    # Try delete PAID invoice
    request = factory.delete(f'/api/billing/invoices/{invoice.id}/delete_invoice/')
    force_authenticate(request, user=manager)
    # Bypass permission classes for direct testing of the action's internal business logic
    invoice_view_delete = InvoiceViewSet.as_view({'delete': 'delete_invoice'}, permission_classes=[])
    response = invoice_view_delete(request, pk=invoice.pk)
    
    if response.status_code == 403:
        print("✅ Success: Manager cannot delete PAID invoice (403)")
    else:
        print(f"❌ Failed: Expected 403 for paid invoice delete, got {response.status_code}")
        
    # Try refund PAID invoice
    request = factory.post(f'/api/billing/invoices/{invoice.id}/refund_invoice/', {'reason': 'Customer requested'}, format='json')
    force_authenticate(request, user=manager)
    # Bypass permission classes for direct testing of the action's internal business logic
    invoice_view_refund = InvoiceViewSet.as_view({'post': 'refund_invoice'}, permission_classes=[])
    response = invoice_view_refund(request, pk=invoice.pk)
    
    invoice.refresh_from_db()
    order2.refresh_from_db()
    if response.status_code == 200 and invoice.is_refunded and order2.status == 'cancelled':
        print("✅ Success: Manager refunded PAID invoice correctly")
        refund_record = Refund.objects.filter(invoice=invoice).exists()
        if refund_record:
            print("✅ Success: Refund record created in database")
    else:
        print(f"❌ Failed: Refund failed. Status: {response.status_code}")
        
    print("\nAll automated tests finished.")

if __name__ == '__main__':
    run_tests()
