import React, { useState, useEffect } from 'react';
import { publicApi } from '../api/publicApi';
import { useCartStore } from '../store/cartStore';
import { useCampaignStore } from '../store/campaignStore';
import { useOfferStore } from '../store/offerStore';
import { Plus, Loader2, Star, Flame, Clock } from 'lucide-react';
import { useRestaurantSlug } from '../restaurantContext';

const MenuPage = () => {
    const restaurantSlug = useRestaurantSlug();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const addItem = useCartStore((state) => state.addItem);
    const { fetchCampaign, getMultiplier } = useCampaignStore();
    const { fetchOffers, getOfferForItem } = useOfferStore();

    useEffect(() => {
        fetchMenu();
        fetchCampaign(restaurantSlug);
        fetchOffers(restaurantSlug);
    }, [restaurantSlug]);

    const fetchMenu = async () => {
        try {
            const response = await publicApi.getMenu(restaurantSlug);
            setCategories(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setLoading(false);
        }
    };

    const allItems = categories.flatMap(cat => cat.items.map(item => ({ ...item, category_id: cat.id })));
    const filteredItems = activeCategory === 'all'
        ? allItems
        : categories.find(c => c.id === activeCategory)?.items || [];

    if (loading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-container px-4 md:px-8 py-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <h2 className="text-4xl font-extrabold dark:text-white">القائمة الشهية</h2>

                {/* Category Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${activeCategory === 'all'
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                            : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 border border-gray-100 dark:border-neutral-800'
                            }`}
                    >
                        الكل
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${activeCategory === cat.id
                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 border border-gray-100 dark:border-neutral-800'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredItems.map((item) => {
                    // Prefer active_offer embedded in item payload; fall back to offerStore
                    const offer = item.active_offer || getOfferForItem(item.id);
                    const effectiveMultiplier = offer ? offer.points_multiplier : getMultiplier();
                    const displayPrice = offer ? offer.discounted_price : item.price;
                    const earnedPoints = Math.floor(displayPrice * effectiveMultiplier);
                    const basePoints = Math.floor(item.price * 1);

                    return (
                        <div
                            key={item.id}
                            className="group bg-white dark:bg-neutral-900 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative"
                        >
                            {/* Offer Badge */}
                            {offer && (
                                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                                    <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                                        <Flame className="w-3 h-3" /> خصم {Number(offer.discount_percentage).toFixed(0)}%
                                    </span>
                                    {offer.points_multiplier > 1 && (
                                        <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow">
                                            <Star className="w-3 h-3 fill-yellow-900" /> نقاط ×{offer.points_multiplier}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="relative h-56 overflow-hidden">
                                <img
                                    src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=500'}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                {!item.is_available && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                        <span className="bg-white px-4 py-1 rounded-lg font-bold text-sm">غير متاح حالياً</span>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 flex flex-col flex-1">
                                <h3 className="text-xl font-bold mb-2 dark:text-white group-hover:text-primary-500 transition-colors">{item.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-neutral-400 mb-6 line-clamp-2 flex-1">
                                    {item.description}
                                </p>

                                <div className="flex items-end justify-between">
                                    <div>
                                        {/* Price Row */}
                                        {offer ? (
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <span className="text-sm text-gray-400 line-through font-bold">
                                                    {Number(item.price).toFixed(0)} جنيه
                                                </span>
                                                <span className="text-2xl font-black text-red-500">
                                                    {Number(displayPrice).toFixed(0)} جنيه
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="text-2xl font-black text-primary-500">{Number(item.price).toFixed(0)}</span>
                                                <span className="text-xs text-gray-400 mr-1 font-bold"> جنيه</span>
                                            </div>
                                        )}

                                        {/* Points Row */}
                                        <div className="flex items-center gap-1 text-xs font-medium mt-1">
                                            <Star size={12} className="fill-orange-500 text-orange-500" />
                                            {offer && offer.points_multiplier > 1 ? (
                                                <span className="text-orange-600">
                                                    اكسب <strong>{earnedPoints}</strong> نقطة بدل {basePoints}
                                                </span>
                                            ) : (
                                                <span className="text-orange-600">تكسب {earnedPoints} نقطة</span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => addItem({ ...item, price: Number(displayPrice) })}
                                        disabled={!item.is_available}
                                        className="p-3 bg-gray-50 dark:bg-neutral-800 text-gray-800 dark:text-white rounded-2xl hover:bg-primary-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:rotate-6 active:scale-95 shadow-md"
                                    >
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-neutral-900 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-neutral-800">
                    <h3 className="text-xl text-gray-500 font-bold">لا يوجد أصناف في هذه الفئة حالياً</h3>
                </div>
            )}
        </div>
    );
};

export default MenuPage;
