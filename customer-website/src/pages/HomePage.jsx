import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChefHat, Clock, Truck, Star, Zap, Tag } from 'lucide-react';
import heroImage from '../assets/hero-food.webp';
import { useCartStore } from '../store/cartStore';
import { useSessionStore } from '../store/sessionStore';
import { useOfferStore } from '../store/offerStore';
import { publicApi } from '../api/publicApi';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

// Countdown hook
function useCountdown(endDateStr) {
    const calc = useCallback(() => {
        if (!endDateStr) return '';
        const dist = new Date(endDateStr).getTime() - Date.now();
        if (dist <= 0) return 'انتهى العرض';
        const d = Math.floor(dist / 86400000);
        const h = Math.floor((dist % 86400000) / 3600000);
        const m = Math.floor((dist % 3600000) / 60000);
        const s = Math.floor((dist % 60000) / 1000);
        if (d > 0) return `${d}ي ${h}س ${m}د`;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, [endDateStr]);

    const [timeLeft, setTimeLeft] = useState(calc);
    useEffect(() => {
        if (!endDateStr) return;
        const id = setInterval(() => setTimeLeft(calc()), 1000);
        return () => clearInterval(id);
    }, [endDateStr, calc]);
    return timeLeft;
}

const HomePage = () => {
    const restaurantSlug = useRestaurantSlug();
    const [campaign, setCampaign] = useState(null);
    const campaignTime = useCountdown(campaign?.end_date);
    const { fetchOffers, getFeaturedOffer } = useOfferStore();
    const featuredOffer = getFeaturedOffer();
    const offerTime = useCountdown(featuredOffer?.end_date);

    useEffect(() => {
        const fetchCampaign = async () => {
            try {
                const res = await publicApi.getActiveCampaign(restaurantSlug);
                if (res.data) setCampaign(res.data);
            } catch {}
        };
        fetchCampaign();
        fetchOffers(restaurantSlug);
    }, [restaurantSlug]);

    return (
        <div className="flex flex-col gap-12">
            {/* Campaign Banner */}
            {campaign && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 text-center font-bold relative overflow-hidden group w-full">
                    <div className="relative z-10 flex flex-wrap items-center justify-center gap-4 text-sm md:text-base">
                        <span className="flex items-center gap-2">
                            🔥 {campaign.name} — كل {10 / campaign.multiplier} جنيه = نقطة
                        </span>
                        {campaignTime && (
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs animate-pulse font-mono">
                                ⏳ {campaignTime}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Featured Product Offer Banner */}
            {featuredOffer && (
                <section className="max-container px-4 md:px-8 -mb-4">
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-red-600 via-orange-500 to-yellow-400 text-white p-8 md:p-10 shadow-2xl shadow-orange-500/30">
                        {/* decorative circles */}
                        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full" />
                        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />

                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-white text-orange-500 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> عرض اليوم
                                    </span>
                                    <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 font-mono">
                                        ⏳ {offerTime}
                                    </span>
                                </div>

                                <h2 className="text-3xl md:text-4xl font-black mb-2 leading-tight">
                                    {featuredOffer.product_name}
                                </h2>

                                <div className="flex items-center gap-4 mb-4">
                                    <span className="text-white/60 line-through text-xl font-bold">
                                        {Number(featuredOffer.product_price).toFixed(0)} جنيه
                                    </span>
                                    <span className="text-4xl font-black text-yellow-200">
                                        {Number(featuredOffer.discounted_price).toFixed(0)} جنيه
                                    </span>
                                    <span className="bg-white/20 px-3 py-1 rounded-xl font-black text-lg">
                                        -{Number(featuredOffer.discount_percentage).toFixed(0)}%
                                    </span>
                                </div>

                                {featuredOffer.points_multiplier > 1 && (
                                    <div className="flex items-center gap-2 text-yellow-200 font-bold text-sm">
                                        <Star className="w-4 h-4 fill-yellow-200" />
                                        اكسب {Math.floor(featuredOffer.discounted_price * featuredOffer.points_multiplier)} نقطة بدلاً من {Math.floor(featuredOffer.discounted_price)} نقطة!
                                    </div>
                                )}
                            </div>

                            <Link
                                to={restaurantPath(restaurantSlug, '/menu')}
                                className="flex-shrink-0 px-8 py-4 bg-white text-orange-600 font-black rounded-2xl hover:bg-yellow-100 transition-all hover:scale-105 shadow-xl flex items-center gap-2 text-lg"
                            >
                                اطلب الآن <ArrowLeft className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* Hero Section */}
            <section className="relative h-[80vh] flex items-center overflow-hidden">
                <div className="absolute inset-0 bg-primary-600/10 dark:bg-primary-900/20" />
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[100%] bg-primary-500/20 blur-[120px] rounded-full" />

                <div className="max-container px-4 md:px-8 relative z-10 flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 text-center md:text-right">
                        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 dark:text-white">
                            طعم يأخذك <span className="text-primary-500">لعالم آخر</span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 dark:text-neutral-400 mb-8 max-w-2xl mx-auto md:mr-0">
                            استمتع بأشهى المأكولات المحضرة بكل حب واتقان. اطلب الآن واستلم طلبك في أسرع وقت.
                        </p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <Link
                                to={restaurantPath(restaurantSlug, '/menu')}
                                className="px-8 py-4 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all hover:scale-105 shadow-lg shadow-primary-500/25 flex items-center gap-2"
                            >
                                تصفح المنيو <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <Link
                                to={restaurantPath(restaurantSlug, '/track')}
                                className="px-8 py-4 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-neutral-700 transition-all"
                            >
                                تتبع طلبك
                            </Link>
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        <img
                            src={heroImage}
                            alt="Delicious Food"
                            className="rounded-3xl shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500 w-full object-cover"
                        />
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="max-container px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 py-12">
                <FeatureCard
                    icon={<ChefHat className="w-10 h-10 text-primary-500" />}
                    title="أفضل الشيفات"
                    desc="نستخدم أفضل المكونات ونعتمد على خبرات طهاة عالميين."
                />
                <FeatureCard
                    icon={<Truck className="w-10 h-10 text-primary-500" />}
                    title="توصيل سريع"
                    desc="فريق توصيل مجهز ليصلك طعامك ساخناً وفي الوقت المحدد."
                />
                <FeatureCard
                    icon={<Clock className="w-10 h-10 text-primary-500" />}
                    title="دعم 24/7"
                    desc="جاهزون للرد على استفساراتكم في أي وقت خلال اليوم."
                />
            </section>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-gray-100 dark:border-neutral-800 shadow-sm hover:shadow-md transition-shadow">
        <div className="bg-primary-50 dark:bg-primary-900/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
            {icon}
        </div>
        <h3 className="text-xl font-bold mb-3 dark:text-white">{title}</h3>
        <p className="text-gray-600 dark:text-neutral-400 leading-relaxed">{desc}</p>
    </div>
);

export default HomePage;
