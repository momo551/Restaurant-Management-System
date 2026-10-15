import React, { useState } from 'react';
import { publicApi } from '../api/publicApi';
import { User, Phone, Star, Gift, Utensils, Award, LogOut, ArrowRight, Loader2, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

const UserDashboardPage = () => {
    const restaurantSlug = useRestaurantSlug();
    const [phone, setPhone] = useState(localStorage.getItem('loyalty_phone') || '');
    const [customerInfo, setCustomerInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (localStorage.getItem('loyalty_phone')) {
            handleLogin(null, localStorage.getItem('loyalty_phone'));
        }
    }, [restaurantSlug]);

    const handleLogin = async (e, savedPhone = null) => {
        if (e) e.preventDefault();
        const phoneToUse = savedPhone || phone;
        if (!phoneToUse) return;

        setLoading(true);
        setError('');
        try {
            const res = await publicApi.getCustomerInfo(restaurantSlug, phoneToUse);
            setCustomerInfo(res.data);
            localStorage.setItem('loyalty_phone', phoneToUse);
            setPhone(phoneToUse);
        } catch {
            setError('تعذر العثور على بيانات بهذا الرقم. يرجى التأكد أو إنشاء طلب جديد لتسجيلك.');
            setCustomerInfo(null);
            localStorage.removeItem('loyalty_phone');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setCustomerInfo(null);
        setPhone('');
        localStorage.removeItem('loyalty_phone');
    };

    if (!customerInfo) {
        return (
            <div className="max-container px-4 md:px-8 py-20 min-h-[70vh] flex items-center justify-center">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 p-8 md:p-12 rounded-[3rem] shadow-xl border border-gray-100 dark:border-neutral-800 text-center">
                    <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/20 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Award className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-extrabold mb-2 dark:text-white">برنامج الولاء</h2>
                    <p className="text-gray-500 dark:text-neutral-400 mb-8">سجل دخول برقم جوالك لمتابعة نقاطك ومكافآتك</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                                placeholder="010XXXXXXXX"
                                className="w-full pl-5 pr-12 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white text-left transition-all font-bold"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
                        <button type="submit" disabled={loading}
                            className="w-full py-4 bg-primary-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-600 transition-all shadow-lg hover:shadow-primary-500/30 disabled:opacity-50">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'دخول'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const { name, points_balance, visits, loyalty_points = [] } = customerInfo;
    const pointsInEgp = Math.floor(points_balance / 10);

    return (
        <div className="max-container px-4 md:px-8 py-10">
            <div className="max-w-4xl mx-auto space-y-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 text-primary-600 rounded-full flex items-center justify-center font-bold text-2xl">
                            {name ? name.charAt(0) : <User />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black dark:text-white mb-1">أهلاً بك، {name}</h2>
                            <p className="text-gray-500 dark:text-neutral-400 flex items-center gap-2">
                                <Phone className="w-4 h-4" /> {phone}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-2xl font-bold transition-colors">
                        <LogOut className="w-4 h-4" /> تسجيل خروج
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Points Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-6 -top-6 text-white/10 group-hover:scale-110 transition-transform duration-500">
                            <Star className="w-40 h-40" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-orange-100 font-bold mb-2 flex items-center gap-2">
                                <Star className="w-5 h-5" /> رصيد النقاط
                            </h3>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-5xl font-black">{points_balance}</span>
                                <span className="text-lg text-orange-200 font-bold">نقطة</span>
                            </div>
                            <p className="bg-orange-600/50 backdrop-blur-sm px-4 py-2 rounded-xl inline-block text-sm font-bold">
                                تقدر تخصم {pointsInEgp} جنيه من طلبك القادم
                            </p>
                        </div>
                    </div>

                    {/* Visits Card */}
                    <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-neutral-800 flex flex-col justify-center">
                        <h3 className="text-gray-500 dark:text-neutral-400 font-bold mb-4 flex items-center gap-2">
                            <Utensils className="w-5 h-5 text-primary-500" /> عدد الطلبات
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black dark:text-white">{visits}</span>
                            <span className="text-lg text-gray-400 font-bold">طلب</span>
                        </div>
                    </div>

                    {/* CTA Card */}
                    <div className="bg-primary-50 dark:bg-primary-900/10 p-8 rounded-[2.5rem] shadow-sm border border-primary-100 dark:border-primary-800/30 flex flex-col justify-center items-center text-center">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-500 rounded-full flex items-center justify-center mb-4">
                            <Gift className="w-8 h-8" />
                        </div>
                        <h3 className="font-bold text-lg dark:text-white mb-2">اطلب دلوقتي وجمع نقاط أكتر</h3>
                        <Link to={restaurantPath(restaurantSlug, '/menu')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20">
                            تصفح المنيو <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Points History */}
                {loyalty_points.length > 0 && (
                    <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
                        <div className="p-8 pb-4 border-b border-gray-100 dark:border-neutral-800 flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
                                <Clock className="w-5 h-5 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold dark:text-white">سجل النقاط</h3>
                        </div>
                        <div className="divide-y divide-gray-50 dark:divide-neutral-800 max-h-80 overflow-y-auto">
                            {loyalty_points.map((tx) => {
                                const isEarned = tx.transaction_type === 'earned';
                                return (
                                    <div key={tx.id} className="flex items-center justify-between px-8 py-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEarned ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                                                {isEarned
                                                    ? <TrendingUp className="w-5 h-5 text-green-600" />
                                                    : <TrendingDown className="w-5 h-5 text-red-500" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm dark:text-white">{tx.description || (isEarned ? 'نقاط مكتسبة' : 'نقاط مستخدمة')}</p>
                                                <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            </div>
                                        </div>
                                        <span className={`font-black text-lg ${isEarned ? 'text-green-600' : 'text-red-500'}`}>
                                            {isEarned ? '+' : ''}{tx.points}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDashboardPage;
