import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from menu.models import Category, MenuItem
from tables.models import Table, QRCode
from stock.models import Ingredient, Recipe
from django.contrib.auth import get_user_model

User = get_user_model()

def seed_data():
    print("Seeding data...")
    
    # 1. Create Categories
    appetizers, _ = Category.objects.get_or_create(name="مقبلات", description="Appetizers")
    main_dishes, _ = Category.objects.get_or_create(name="الأطباق الرئيسية", description="Main Dishes")
    drinks, _ = Category.objects.get_or_create(name="مشروبات", description="Drinks")
    
    # 2. Create Ingredients
    meat, _ = Ingredient.objects.get_or_create(name="لحم بقري", unit="kg", reorder_level=10)
    bread, _ = Ingredient.objects.get_or_create(name="خبز برجر", unit="piece", reorder_level=50)
    tomato, _ = Ingredient.objects.get_or_create(name="طماطم", unit="kg", reorder_level=5)
    
    # 3. Create Menu Items
    burger, _ = MenuItem.objects.get_or_create(
        name="تشيز برجر كلاسيك",
        category=main_dishes,
        price=150.00,
        description="برجر لحم مشوي مع جبنة شيدر"
    )
    
    pasta, _ = MenuItem.objects.get_or_create(
        name="باستا ألفريدو",
        category=main_dishes,
        price=120.00,
        description="باستا بصوص الكريمة والمشروم"
    )
    
    # 4. Create Recipes
    Recipe.objects.get_or_create(menu_item=burger, ingredient=meat, quantity_required=0.2)
    Recipe.objects.get_or_create(menu_item=burger, ingredient=bread, quantity_required=1)
    
    # 5. Create Tables & QR Codes
    for i in range(1, 6):
        table, created = Table.objects.get_or_create(
            number=i,
            defaults={'capacity': 4, 'floor': 1, 'status': 'available', 'position_x': 10 * i, 'position_y': 20}
        )
        QRCode.objects.get_or_create(
            table=table,
            defaults={'code': uuid.uuid4()}
        )
        print(f"Created Table {i} with QR Code.")

    print("Data seeded successfully!")

if __name__ == "__main__":
    seed_data()
