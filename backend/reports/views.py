from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import models
from django.db.models import Sum, Count, F
from django.db.models.functions import TruncDate, TruncHour
from django.utils import timezone
from datetime import timedelta
from orders.models import Order, OrderItem
from menu.models import MenuItem
from stock.models import Recipe
from users.permissions import HasReportsAccess


class ReportViewSet(viewsets.ViewSet):
    """ViewSet for analytics and reports."""
    permission_classes = [HasReportsAccess]

    # الحالات التي تُعدّ "مكتملة" ويجب احتسابها في المبيعات
    COMPLETED_STATUSES = ['served', 'delivered', 'paid']

    def _get_orders_qs(self, request):
        qs = Order.objects.filter(is_deleted=False)
        user = request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(restaurant_id=user.restaurant_id)
        return qs.none()

    def _get_order_items_qs(self, request):
        qs = OrderItem.objects.filter(order__is_deleted=False)
        user = request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs
        if user.restaurant_id:
            return qs.filter(order__restaurant_id=user.restaurant_id)
        return qs.none()

    def _get_date_range(self, period):
        """Helper to get start and end dates based on period."""
        end_date = timezone.now()
        if period == '7days':
            start_date = end_date - timedelta(days=7)
        elif period == '90days':
            start_date = end_date - timedelta(days=90)
        elif period == 'year':
            start_date = end_date.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:  # default 30days
            start_date = end_date - timedelta(days=30)
        return start_date, end_date

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get summary stats for the dashboard."""
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        COMPLETED = self.COMPLETED_STATUSES
        base_qs = self._get_orders_qs(request)

        # ---- بيانات اليوم ----
        today_orders_qs = base_qs.filter(created_at__date=today)

        today_sales = (
            today_orders_qs
            .filter(status__in=COMPLETED)
            .aggregate(total=Sum('total'))['total'] or 0
        )
        today_orders_count = today_orders_qs.filter(status__in=COMPLETED).count()
        today_pending = today_orders_qs.exclude(
            status__in=COMPLETED + ['cancelled']
        ).count()
        today_customers = today_orders_count

        # ---- بيانات الأمس ----
        yesterday_orders_qs = base_qs.filter(created_at__date=yesterday)

        yesterday_sales = (
            yesterday_orders_qs
            .filter(status__in=COMPLETED)
            .aggregate(total=Sum('total'))['total'] or 0
        )
        yesterday_orders_count = yesterday_orders_qs.filter(status__in=COMPLETED).count()
        yesterday_pending = yesterday_orders_qs.exclude(
            status__in=COMPLETED + ['cancelled']
        ).count()
        yesterday_customers = yesterday_orders_count

        def calculate_trend(today_val, yesterday_val):
            if yesterday_val == 0:
                return 100 if today_val > 0 else 0
            return round(((today_val - yesterday_val) / yesterday_val) * 100, 1)

        return Response({
            'today_sales': float(today_sales),
            'today_sales_trend': calculate_trend(today_sales, yesterday_sales),
            'today_orders_count': today_orders_count,
            'today_orders_trend': calculate_trend(today_orders_count, yesterday_orders_count),
            'pending_orders': today_pending,
            'pending_orders_trend': calculate_trend(today_pending, yesterday_pending),
            'total_customers_today': today_customers,
            'total_customers_trend': calculate_trend(today_customers, yesterday_customers),
        })

    @action(detail=False, methods=['get'])
    def best_selling(self, request):
        """Get top selling items."""
        period = request.query_params.get('period', '30days')
        start_date, end_date = self._get_date_range(period)

        top_items = self._get_order_items_qs(request).filter(
            order__created_at__range=[start_date, end_date],
            order__status__in=self.COMPLETED_STATUSES
        ).values(
            'menu_item__name', 'menu_item__name_en'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum('subtotal')
        ).order_by('-total_quantity')[:10]

        return Response(top_items)

    @action(detail=False, methods=['get'])
    def sales_chart(self, request):
        """Get sales data for charts based on period."""
        period = request.query_params.get('period', '30days')
        start_date, end_date = self._get_date_range(period)

        sales_data = (
            self._get_orders_qs(request)
            .filter(
                created_at__range=[start_date, end_date],
                status__in=self.COMPLETED_STATUSES
            )
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(
                total_sales=Sum('total'),
                order_count=Count('id')
            )
            .order_by('day')
        )

        result = [
            {
                'day': item['day'].isoformat() if item['day'] else None,
                'total_sales': float(item['total_sales'] or 0),
                'order_count': item['order_count'],
            }
            for item in sales_data
        ]

        return Response(result)

    @action(detail=False, methods=['get'])
    def delivery_performance(self, request):
        """Get performance stats for delivery agents."""
        period = request.query_params.get('period', '30days')
        start_date, end_date = self._get_date_range(period)

        performance = self._get_orders_qs(request).filter(
            order_type=Order.OrderType.DELIVERY,
            delivery_status=Order.DeliveryStatus.DELIVERED,
            created_at__range=[start_date, end_date]
        ).values(
            'delivery_agent_name'
        ).annotate(
            total_orders=Count('id'),
            total_fees=Sum('delivery_fee'),
            total_commissions=Sum('delivery_commission')
        ).order_by('-total_orders')

        results = []
        for p in performance:
            name = p['delivery_agent_name'] or 'غير محدد'
            results.append({
                'agent_name': name,
                'orders_count': p['total_orders'],
                'total_fees': float(p['total_fees'] or 0),
                'total_commissions': float(p['total_commissions'] or 0),
            })

        return Response(results)

    @action(detail=False, methods=['get'])
    def hourly_sales(self, request):
        """Get sales data grouped by hour for today."""
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        hourly_data = (
            self._get_orders_qs(request)
            .filter(
                created_at__range=[today_start, today_end],
                status__in=self.COMPLETED_STATUSES
            )
            .annotate(hour=TruncHour('created_at'))
            .values('hour')
            .annotate(
                total_sales=Sum('total'),
                order_count=Count('id')
            )
            .order_by('hour')
        )
        
        result = [
            {
                'hour': item['hour'].strftime('%H:00') if item['hour'] else None,
                'total_sales': float(item['total_sales'] or 0),
                'order_count': item['order_count'],
            }
            for item in hourly_data
        ]
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def menu_performance(self, request):
        """
        ABC Analysis and Profit Margin calculation for Menu Items.
        """
        period = request.query_params.get('period', '30days')
        start_date, end_date = self._get_date_range(period)

        items_performance = self._get_order_items_qs(request).filter(
            order__created_at__range=[start_date, end_date],
            order__status__in=self.COMPLETED_STATUSES
        ).values(
            'menu_item__id', 'menu_item__name'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum('subtotal')
        ).order_by('-total_revenue')

        menu_item_ids = [item['menu_item__id'] for item in items_performance]
        
        # Add restaurant filtering to menu items query
        menu_items_queryset = MenuItem.objects.filter(id__in=menu_item_ids)
        if request.user.restaurant:
            menu_items_queryset = menu_items_queryset.filter(category__restaurant=request.user.restaurant)
        
        menu_items_map = {
            mi.id: mi for mi in menu_items_queryset.prefetch_related(
                models.Prefetch('recipes', queryset=Recipe.objects.select_related('ingredient'))
            )
        }

        total_system_revenue = sum(float(item['total_revenue'] or 0) for item in items_performance)
        results = []
        cumulative_revenue = 0

        for item in items_performance:
            menu_item_id = item['menu_item__id']
            mi = menu_items_map.get(menu_item_id)
            if not mi:
                continue
            
            production_cost = float(mi.production_cost)
            unit_price = float(mi.price)
            profit_margin = unit_price - production_cost
            total_qty = float(item['total_quantity'] or 0)
            item_revenue = float(item['total_revenue'] or 0)
            
            cumulative_revenue += item_revenue
            revenue_percent = cumulative_revenue / total_system_revenue if total_system_revenue else 0
            
            if revenue_percent <= 0.70:
                abc_class = 'A'
            elif revenue_percent <= 0.90:
                abc_class = 'B'
            else:
                abc_class = 'C'

            results.append({
                'id': menu_item_id,
                'name': mi.name,
                'total_quantity': total_qty,
                'total_revenue': item_revenue,
                'production_cost': production_cost,
                'unit_price': unit_price,
                'profit_margin': profit_margin,
                'total_profit': profit_margin * total_qty,
                'abc_class': abc_class
            })

        return Response(results)

    @action(detail=False, methods=['get'])
    def staff_performance(self, request):
        """KPIs and tracking for Cashiers and Waiters."""
        period = request.query_params.get('period', '30days')
        start_date, end_date = self._get_date_range(period)

        staff_data = self._get_orders_qs(request).filter(
            created_at__range=[start_date, end_date],
            status__in=self.COMPLETED_STATUSES,
            created_by__isnull=False
        ).values(
            'created_by__first_name', 'created_by__last_name', 'created_by__username', 'created_by__role'
        ).annotate(
            total_orders=Count('id'),
            total_sales=Sum('total')
        ).order_by('-total_sales')

        results = []
        for staff in staff_data:
            first = staff['created_by__first_name'] or ''
            last = staff['created_by__last_name'] or ''
            name = f"{first} {last}".strip() or staff['created_by__username']
            
            total_sales = float(staff['total_sales'] or 0)
            total_orders = staff['total_orders'] or 0
            
            results.append({
                'staff_name': name,
                'role': staff['created_by__role'],
                'total_orders': total_orders,
                'total_sales': total_sales,
                'average_order_value': total_sales / total_orders if total_orders > 0 else 0
            })

        return Response(results)

    @action(detail=False, methods=['get'])
    def staff_performance_pdf(self, request):
        """Export staff performance report as PDF with Arabic support."""
        from django.http import HttpResponse
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import arabic_reshaper
        from bidi.algorithm import get_display
        import os

        period = request.query_params.get('period', '30days')
        response_data = self.staff_performance(request).data

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="staff_performance_{period}.pdf"'

        doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []

        font_path = r'C:\Windows\Fonts\arial.ttf'
        font_name = 'Arial-Arabic'
        try:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
        except:
            pass

        def process_arabic(text):
            if not text:
                return ""
            reshaped_text = arabic_reshaper.reshape(str(text))
            bidi_text = get_display(reshaped_text)
            return bidi_text

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ArabicTitle',
            parent=styles['Heading1'],
            fontName=font_name,
            fontSize=18,
            alignment=1,
            spaceAfter=20
        )

        elements.append(Paragraph(process_arabic(f"تقرير أداء الموظفين - {period}"), title_style))
        elements.append(Spacer(1, 12))

        data = [[
            process_arabic("متوسط الفاتورة"),
            process_arabic("إجمالي المبيعات"),
            process_arabic("إجمالي الطلبات"),
            process_arabic("الدور"),
            process_arabic("اسم الموظف")
        ]]

        for staff in response_data:
            data.append([
                process_arabic(f"{staff['average_order_value']:.2f}"),
                process_arabic(f"{staff['total_sales']:.2f}"),
                process_arabic(str(staff['total_orders'])),
                process_arabic(staff['role']),
                process_arabic(staff['staff_name'])
            ])

        table = Table(data, colWidths=[100, 100, 80, 100, 120])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, -1), font_name),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        elements.append(table)
        doc.build(elements)
        return response
