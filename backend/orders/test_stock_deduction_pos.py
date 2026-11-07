"""
Test cases for stock deduction from POS (Point of Sale) orders.

This test suite verifies that:
1. Stock is correctly deducted when creating orders from POS
2. Stock deduction follows the recipe quantities
3. Multiple quantities are calculated correctly
4. No double deduction occurs
5. Multi-tenant isolation is maintained
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from tenants.models import Restaurant
from menu.models import Category, MenuItem
from stock.models import Ingredient, Recipe, InventoryMovement
from orders.models import Order, OrderItem
from orders.serializers import OrderSerializer

User = get_user_model()


class StockDeductionFromPOSTest(TestCase):
    """Test stock deduction when creating orders from POS."""

    def setUp(self):
        """Set up test data for a single restaurant."""
        self.restaurant = Restaurant.objects.create(
            name="Test Restaurant",
            slug="test-rest",
            is_active=True
        )

        self.user = User.objects.create_user(
            username='cashier',
            password='testpass123',
            restaurant=self.restaurant,
            role='cashier'
        )

        self.category = Category.objects.create(
            name="Burgers",
            restaurant=self.restaurant
        )

        # Create ingredients
        self.beef_patty = Ingredient.objects.create(
            name="Beef Patty",
            unit="kg",
            quantity=Decimal('10.000'),
            restaurant=self.restaurant
        )

        self.cheese = Ingredient.objects.create(
            name="Cheese",
            unit="kg",
            quantity=Decimal('5.000'),
            restaurant=self.restaurant
        )

        # Create menu item with recipe
        self.burger = MenuItem.objects.create(
            name="Cheese Burger",
            price=Decimal('50.00'),
            category=self.category
        )

        # Recipe: 200g beef patty + 50g cheese per burger
        Recipe.objects.create(
            menu_item=self.burger,
            ingredient=self.beef_patty,
            quantity_required=Decimal('0.200')
        )
        Recipe.objects.create(
            menu_item=self.burger,
            ingredient=self.cheese,
            quantity_required=Decimal('0.050')
        )

    def test_single_item_order_deducts_stock(self):
        """Test that a single item order deducts stock correctly."""
        initial_beef = self.beef_patty.quantity
        initial_cheese = self.cheese.quantity

        # Create order via serializer (simulating POS)
        order_data = {
            'order_type': 'takeaway',
            'customer_name': 'Test Customer',
            'customer_phone': '1234567890',
            'items': [
                {
                    'menu_item': self.burger.id,
                    'quantity': 1,
                    'unit_price': Decimal('50.00'),
                    'notes': ''
                }
            ]
        }

        serializer = OrderSerializer(
            data=order_data,
            context={
                'request': type('Request', (), {'user': self.user})()
            }
        )

        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        order = serializer.save(created_by=self.user, restaurant=self.restaurant)

        # Refresh ingredients from DB
        self.beef_patty.refresh_from_db()
        self.cheese.refresh_from_db()

        # Expected: 200g beef, 50g cheese deducted
        self.assertEqual(
            self.beef_patty.quantity,
            initial_beef - Decimal('0.200'),
            "Beef patty should be deducted by 0.200kg"
        )
        self.assertEqual(
            self.cheese.quantity,
            initial_cheese - Decimal('0.050'),
            "Cheese should be deducted by 0.050kg"
        )

        # Check inventory movements
        movements = InventoryMovement.objects.filter(order_id=order.id)
        self.assertEqual(movements.count(), 2, "Should have 2 inventory movements")

    def test_multiple_quantity_order_deducts_correctly(self):
        """Test that ordering multiple items deducts stock proportionally."""
        initial_beef = self.beef_patty.quantity
        initial_cheese = self.cheese.quantity

        # Order 3 burgers
        order_data = {
            'order_type': 'takeaway',
            'customer_name': 'Test Customer',
            'customer_phone': '1234567890',
            'items': [
                {
                    'menu_item': self.burger.id,
                    'quantity': 3,
                    'unit_price': Decimal('50.00'),
                    'notes': ''
                }
            ]
        }

        serializer = OrderSerializer(
            data=order_data,
            context={
                'request': type('Request', (), {'user': self.user})()
            }
        )

        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        order = serializer.save(created_by=self.user, restaurant=self.restaurant)

        # Refresh ingredients
        self.beef_patty.refresh_from_db()
        self.cheese.refresh_from_db()

        # Expected: 3 * 200g = 600g beef, 3 * 50g = 150g cheese
        self.assertEqual(
            self.beef_patty.quantity,
            initial_beef - Decimal('0.600'),
            "Beef patty should be deducted by 0.600kg"
        )
        self.assertEqual(
            self.cheese.quantity,
            initial_cheese - Decimal('0.150'),
            "Cheese should be deducted by 0.150kg"
        )

    def test_no_deduction_for_item_without_recipe(self):
        """Test that items without recipes don't cause errors."""
        # Create menu item without recipe
        drink = MenuItem.objects.create(
            name="Coke",
            price=Decimal('10.00'),
            category=self.category
        )

        initial_beef = self.beef_patty.quantity

        order_data = {
            'order_type': 'takeaway',
            'customer_name': 'Test Customer',
            'customer_phone': '1234567890',
            'items': [
                {
                    'menu_item': drink.id,
                    'quantity': 2,
                    'unit_price': Decimal('10.00'),
                    'notes': ''
                }
            ]
        }

        serializer = OrderSerializer(
            data=order_data,
            context={
                'request': type('Request', (), {'user': self.user})()
            }
        )

        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        order = serializer.save(created_by=self.user, restaurant=self.restaurant)

        # Beef should not be deducted
        self.beef_patty.refresh_from_db()
        self.assertEqual(
            self.beef_patty.quantity,
            initial_beef,
            "Beef patty should not be deducted for item without recipe"
        )

    def test_insufficient_stock_raises_error(self):
        """Test that insufficient stock raises validation error."""
        # Set beef to very low quantity
        self.beef_patty.quantity = Decimal('0.100')
        self.beef_patty.save()

        order_data = {
            'order_type': 'takeaway',
            'customer_name': 'Test Customer',
            'customer_phone': '1234567890',
            'items': [
                {
                    'menu_item': self.burger.id,
                    'quantity': 1,
                    'unit_price': Decimal('50.00'),
                    'notes': ''
                }
            ]
        }

        serializer = OrderSerializer(
            data=order_data,
            context={
                'request': type('Request', (), {'user': self.user})()
            }
        )

        # Should fail validation due to insufficient stock
        self.assertFalse(serializer.is_valid())
        self.assertIn('error', serializer.errors)

    def test_multi_tenant_isolation(self):
        """Test that orders from one restaurant don't affect another restaurant's stock."""
        # Create second restaurant
        restaurant2 = Restaurant.objects.create(
            name="Restaurant 2",
            slug="rest2",
            is_active=True
        )

        user2 = User.objects.create_user(
            username='cashier2',
            password='testpass123',
            restaurant=restaurant2,
            role='cashier'
        )

        category2 = Category.objects.create(
            name="Burgers",
            restaurant=restaurant2
        )

        # Create ingredient for restaurant 2
        beef2 = Ingredient.objects.create(
            name="Beef Patty",
            unit="kg",
            quantity=Decimal('10.000'),
            restaurant=restaurant2
        )

        burger2 = MenuItem.objects.create(
            name="Cheese Burger",
            price=Decimal('50.00'),
            category=category2
        )

        Recipe.objects.create(
            menu_item=burger2,
            ingredient=beef2,
            quantity_required=Decimal('0.200')
        )

        # Order from restaurant 1
        order_data = {
            'order_type': 'takeaway',
            'customer_name': 'Test Customer',
            'customer_phone': '1234567890',
            'items': [
                {
                    'menu_item': self.burger.id,
                    'quantity': 1,
                    'unit_price': Decimal('50.00'),
                    'notes': ''
                }
            ]
        }

        serializer = OrderSerializer(
            data=order_data,
            context={
                'request': type('Request', (), {'user': self.user})()
            }
        )

        self.assertTrue(serializer.is_valid())
        serializer.save(created_by=self.user, restaurant=self.restaurant)

        # Restaurant 2's stock should be unchanged
        beef2.refresh_from_db()
        self.assertEqual(beef2.quantity, Decimal('10.000'), "Restaurant 2 stock should not be affected")
