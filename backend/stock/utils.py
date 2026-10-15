from decimal import Decimal
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from collections import defaultdict
from menu.models import MenuItem
from stock.models import Ingredient

def validate_stock_availability(items_data, order_instance=None, restaurant=None):
    """
    Validates if there is enough stock for the provided order items.
    
    items_data: List of dicts with {'menu_item': id/instance, 'quantity': int}
    order_instance: If provided, handles adjustments for existing orders.
    restaurant: Restaurant instance for tenant filtering
    """
    # 1. Aggregate required ingredients
    requirements = defaultdict(Decimal)
    
    for item in items_data:
        menu_item = item.get('menu_item')
        if not isinstance(menu_item, MenuItem):
            # If it's an ID, fetch the object with tenant filtering
            try:
                # Use ID if it's already an int/string, otherwise it might be the object itself
                menu_item_id = menu_item.id if hasattr(menu_item, 'id') else menu_item
                
                # Apply tenant filtering if restaurant is provided
                menu_item_queryset = MenuItem.objects.filter(id=menu_item_id)
                if restaurant:
                    menu_item_queryset = menu_item_queryset.filter(category__restaurant=restaurant)
                
                menu_item = menu_item_queryset.get()
            except MenuItem.DoesNotExist:
                continue # Should be handled by serializer/view validation
        
        quantity = Decimal(str(item.get('quantity', 0)))
        
        # If order_instance exists, we check if this specific menu_item was already in the order
        # to calculate the delta. This is tricky because an order can have multiple items of the same menu_item.
        # However, OrderViewSet.edit seems to handle item IDs, but here we are passed the NEW state.
        
        recipes = menu_item.recipes.all()
        for recipe in recipes:
            requirements[recipe.ingredient_id] += Decimal(str(recipe.quantity_required)) * quantity

    # 2. Subtract what's already allocated to this order (if updating)
    if order_instance:
        for item in order_instance.items.all():
            recipes = item.menu_item.recipes.all()
            for recipe in recipes:
                requirements[recipe.ingredient_id] -= Decimal(str(recipe.quantity_required)) * Decimal(str(item.quantity))

    # 3. Check availability
    insufficient = []
    
    # We only care about positive requirements (additional stock needed)
    needed_ingredient_ids = [ing_id for ing_id, qty in requirements.items() if qty > 0]
    
    if not needed_ingredient_ids:
        return True

    # Apply tenant filtering to ingredients
    ingredients_queryset = Ingredient.objects.filter(id__in=needed_ingredient_ids)
    if restaurant:
        ingredients_queryset = ingredients_queryset.filter(restaurant=restaurant)
    
    ingredients = ingredients_queryset
    ingredients_dict = {ing.id: ing for ing in ingredients}

    for ing_id, needed_qty in requirements.items():
        if needed_qty <= 0:
            continue
            
        ingredient = ingredients_dict.get(ing_id)
        if not ingredient or ingredient.quantity < needed_qty:
            ing_name = ingredient.name if ingredient else f"مكون معرف {ing_id}"
            insufficient.append(f"{ing_name} (مطلوب: {needed_qty}, متاح: {ingredient.quantity if ingredient else 0})")

    if insufficient:
        error_msg = "رصيد غير كافٍ في المخزن للمكونات التالية: " + ", ".join(insufficient)
        raise ValidationError({'error': error_msg})

    return True
