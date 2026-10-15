import React from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useCampaignStore } from '../store/campaignStore';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, Star } from 'lucide-react';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

const CartPage = () => {
    const restaurantSlug = useRestaurantSlug();
    const { items, updateQuantity, removeItem, getTotal, getDeliveryFee } = useCartStore();
    const { fetchCampaign, getMultiplier } = useCampaignStore();

    React.useEffect(() => {
        fetchCampaign(restaurantSlug);
    }, [restaurantSlug]);

    if (items.length === 0) {
        return (
            <div className="max-container px-4 py-20 text-center">
                <div className="bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 rounded-[3rem] p-12 shadow-sm max-w-2xl mx-auto">
                    <ShoppingBag className="w-20 h-20 text-gray-200 dark:text-neutral-800 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold mb-4 dark:text-white">سلتك فاضية</h2>
                    <p className="text-gray-500 mb-8">تقدر تروح للمنيو وتختار أكتر أكلة بتحبها</p>
                    <Link
                        to={restaurantPath(restaurantSlug, '/menu')}
                        className="inline-flex items-center gap-2 px-10 py-4 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all shadow-lg shadow-primary-500/20"
                    >
                        تصفح المنيو <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-container px-4 md:px-8 py-10">
            <h2 className="text-4xl font-extrabold mb-10 dark:text-white">سلة الطلبات</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Items List */}
                <div className="lg:col-span-2 space-y-6">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-gray-100 dark:border-neutral-800 flex items-center gap-6 group hover:shadow-md transition-shadow"
                        >
                            <img
                                src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200'}
                                alt={item.name}
                                className="w-24 h-24 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform"
                            />
                            <div className="flex-1">
                                <h3 className="text-lg font-bold dark:text-white mb-1">{item.name}</h3>
                                <p className="text-primary-500 font-black text-xl">{item.price} <span className="text-xs">جنيه</span></p>
                            </div>

                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-neutral-800 p-2 rounded-2xl">
                                <button
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl transition-colors dark:text-white"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-6 text-center font-bold dark:text-white">{item.quantity}</span>
                                <button
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="p-2 hover:bg-white dark:hover:bg-neutral-700 rounded-xl transition-colors dark:text-white"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => removeItem(item.id)}
                                className="p-3 text-red-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
                            >
                                <Trash2 className="w-6 h-6" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Summary */}
                <div className="lg:col-span-1">
                    <div className="bg-neutral-900 dark:bg-neutral-900 dark:border dark:border-neutral-800 text-white p-8 rounded-[2.5rem] sticky top-24 shadow-2xl">
                        <h3 className="text-2xl font-bold mb-8">ملخص الطلب</h3>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-neutral-400">
                                <span>الإجمالي الفرعي</span>
                                <span className="font-bold">{getTotal()} جنيه</span>
                            </div>
                            <div className="flex justify-between text-neutral-400">
                                <span>رسوم التوصيل</span>
                                <span className="font-bold text-primary-500">+{getDeliveryFee()} جنيه</span>
                            </div>
                            <div className="h-[1px] bg-neutral-800 my-4" />
                            <div className="flex justify-between text-xl font-bold">
                                <span>الإجمالي</span>
                                <span className="text-primary-500 text-3xl">{getTotal() + getDeliveryFee()}</span>
                            </div>
                            <div className="flex justify-between items-center bg-orange-500/10 p-3 rounded-2xl border border-orange-500/20">
                                <span className="text-orange-500 flex items-center gap-2">
                                    <Star className="w-5 h-5 fill-orange-500" />
                                    النقاط المكتسبة
                                </span>
                                <span className="font-bold text-orange-500">
                                    +{Math.floor((getTotal() + getDeliveryFee()) * getMultiplier())} نقطة
                                </span>

                            </div>
                        </div>

                        <Link
                            to={restaurantPath(restaurantSlug, '/checkout')}
                            className="w-full py-4 bg-primary-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-600 transition-all hover:scale-[1.02] shadow-xl shadow-primary-500/20"
                        >
                            متابعة الشراء <ArrowRight className="w-6 h-6" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartPage;
