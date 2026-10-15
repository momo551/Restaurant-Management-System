import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Moon, Sun, UtensilsCrossed, Star } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useThemeStore } from '../store/themeStore';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

const Navbar = () => {
    const itemsCount = useCartStore((state) => state.itemsCount());
    const { isDarkMode, toggleDarkMode } = useThemeStore();
    const restaurantSlug = useRestaurantSlug();
    const toRestaurant = (suffix = '') => restaurantPath(restaurantSlug, suffix);

    return (
        <nav className="sticky top-0 z-50 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 shadow-sm transition-colors duration-200">
            <div className="max-container flex items-center justify-between h-16 px-4 md:px-8">
                {/* Logo */}
                <Link to={toRestaurant()} className="flex items-center gap-2 group">
                    <UtensilsCrossed className="w-8 h-8 text-primary-500 group-hover:rotate-12 transition-transform" />
                    <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                        Yummy Food
                    </span>
                </Link>

                {/* Links */}
                <div className="flex items-center gap-4 md:gap-8 text-sm font-medium">
                    <Link to={toRestaurant('/menu')} className="hover:text-primary-500 transition-colors">المنيو</Link>
                    <Link to={toRestaurant('/track')} className="hover:text-primary-500 transition-colors">تتبع الطلب</Link>
                    <Link to={toRestaurant('/loyalty')} className="hover:text-orange-500 text-orange-600 flex items-center gap-1 transition-colors font-bold"><Star className="w-4 h-4 fill-orange-500" /> مكافآتي</Link>

                    <div className="h-6 w-[1px] bg-gray-200 dark:bg-neutral-700 mx-2" />

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-gray-600" />}
                    </button>

                    {/* Cart Icon */}
                    <Link to={toRestaurant('/cart')} className="relative p-2 group">
                        <ShoppingCart className="w-6 h-6 text-gray-700 dark:text-neutral-300 group-hover:text-primary-500 transition-colors" />
                        {itemsCount > 0 && (
                            <span className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900">
                                {itemsCount}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
