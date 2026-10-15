import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from stock.models import Ingredient

def add_stock():
    print("Adding initial stock to ingredients...")
    Ingredient.objects.filter(name="لحم بقري").update(quantity=100)
    Ingredient.objects.filter(name="خبز برجر").update(quantity=500)
    Ingredient.objects.filter(name="طماطم").update(quantity=50)
    print("Stock updated successfully!")

if __name__ == "__main__":
    add_stock()
