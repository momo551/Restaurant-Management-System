import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    Users,
    Gift,
    Ticket,
    TrendingUp,
    Star,
    Award,
    ChevronRight,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Tag,
    Clock,
    Flame,
    Edit2,
    Trash2
} from 'lucide-react';
import CouponModal from '../components/CouponModal';
import CampaignModal from '../components/CampaignModal';
import ProductOfferModal from '../components/ProductOfferModal';
import CustomerPointsModal from '../components/CustomerPointsModal';

export default function LoyaltyDashboard() {
    const [stats, setStats] = useState({
        total_customers: 0,
        total_points_redeemed: 0,
        coupons_used_count: 0,
        highest_spending: [],
        most_visited: []
    });
    const [activeCampaign, setActiveCampaign] = useState(null);
    const [offers, setOffers] = useState([]);
    const [coupons, setCoupons] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customers, setCustomers] = useState([]);
    
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [offerToEdit, setOfferToEdit] = useState(null);
    const [couponToEdit, setCouponToEdit] = useState(null);
    const [showAllTopCustomers, setShowAllTopCustomers] = useState(false);
    const [selectedCustomerForPoints, setSelectedCustomerForPoints] = useState(null);
    const [showPointsModal, setShowPointsModal] = useState(false);
    
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        fetchLoyaltyData();
    }, []);

    const fetchLoyaltyData = async () => {
        try {
            setError(null);
            const [statsRes, customersRes, campaignRes, offersRes, couponsRes, menuRes] = await Promise.all([
                api.get('/loyalty/customers/statistics/'),
                api.get('/loyalty/customers/'),
                api.get('/loyalty/campaigns/active/'),
                api.get('/menu/offers/'),
                api.get('/loyalty/coupons/'),
                api.get('/menu/items/')
            ]);
            setStats(statsRes.data);
            setCustomers(customersRes.data);
            setActiveCampaign(campaignRes.data);
            setOffers(offersRes.data);
            setCoupons(couponsRes.data);
            setMenuItems(menuRes.data);
        } catch (err) {
            console.error('Error fetching loyalty data', err);
            setError('فشل في تحميل بيانات الولاء. يرجى المحاولة مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCoupon = async (couponData, couponId = null) => {
        try {
            const payload = { ...couponData };
            if (!payload.customer) delete payload.customer;
            
            if (couponId) {
                await api.patch(`/loyalty/coupons/${couponId}/`, payload);
                showToast('تم تحديث الكوبون بنجاح ✅', 'success');
            } else {
                await api.post('/loyalty/coupons/', payload);
                showToast('تم إنشاء الكوبون بنجاح ✅', 'success');
            }
            await fetchLoyaltyData();
        } catch (err) {
            console.error('Error saving coupon:', err);
            showToast('فشل في حفظ الكوبون. تأكد من صحة البيانات.', 'error');
            throw err;
        }
    };

    const handleActivateOffer = () => {
        // If no active campaign exists, open modal to create one
        setShowCampaignModal(true);
    };

    const handleConfirmCampaign = async (formData) => {
        try {
            if (activeCampaign) {
                // Update existing campaign
                const res = await api.patch(`/loyalty/campaigns/${activeCampaign.id}/`, formData);
                setActiveCampaign(res.data);
                showToast('تم تحديث الحملة بنجاح', 'success');
            } else {
                // Create new campaign
                const res = await api.post('/loyalty/campaigns/', { ...formData, is_active: true });
                setActiveCampaign(res.data);
                showToast('تم إنشاء وتفعيل الحملة بنجاح ✅', 'success');
            }
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error saving campaign:', err);
            showToast('فشل في حفظ الحملة. تأكد من صحة البيانات.', 'error');
        }
    };

    const confirmCampaignToggle = async () => {
        try {
            const res = await api.post(`/loyalty/campaigns/${activeCampaign.id}/toggle/`);
            setActiveCampaign(prev => ({ 
                ...prev, 
                is_active: res.data.is_active
            }));
            showToast(res.data.message, 'success');
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error toggling campaign:', err);
            showToast('فشل في تغيير حالة الحملة.', 'error');
        }
    };

    const handleToggleProductOffer = async (offerId) => {
        try {
            const res = await api.post(`/menu/offers/${offerId}/toggle_active/`);
            showToast(res.data.message, 'success');
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error toggling offer:', err);
            showToast('فشل في تغيير حالة العرض', 'error');
        }
    };

    const handleToggleCoupon = async (couponId, currentStatus) => {
        try {
            await api.patch(`/loyalty/coupons/${couponId}/`, { is_active: !currentStatus });
            showToast(`تم ${!currentStatus ? 'تفعيل' : 'إيقاف'} الكوبون بنجاح`, 'success');
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error toggling coupon:', err);
            showToast('فشل في تغيير حالة الكوبون', 'error');
        }
    };

    const handleDeleteOffer = async (offerId, productName) => {
        if (!window.confirm(`هل أنت متأكد من حذف عرض "${productName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }
        
        try {
            await api.delete(`/menu/offers/${offerId}/`);
            showToast('تم حذف العرض بنجاح', 'success');
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error deleting offer:', err);
            showToast('فشل في حذف العرض', 'error');
        }
    };

    const handleDeleteCoupon = async (couponId, couponCode) => {
        if (!window.confirm(`هل أنت متأكد من حذف الكوبون "${couponCode}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }
        
        try {
            await api.delete(`/loyalty/coupons/${couponId}/`);
            showToast('تم حذف الكوبون بنجاح', 'success');
            fetchLoyaltyData();
        } catch (err) {
            console.error('Error deleting coupon:', err);
            showToast('فشل في حذف الكوبون', 'error');
        }
    };

    const showToast = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">جاري تحميل بيانات الولاء والعروض...</div>;

    if (error) return (
        <div className="p-10 text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block">
                {error}
                <button onClick={fetchLoyaltyData} className="mr-4 underline font-bold hover:text-red-800">
                    إعادة المحاولة
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        برنامج الولاء والعروض <Star className="text-yellow-500 fill-yellow-500" />
                    </h1>
                    <p className="text-slate-500">إدارة المكافآت وعروض المنتجات لتحفيز المبيعات.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setOfferToEdit(null); setShowOfferModal(true); }}
                        className="bg-orange-50 text-orange-600 px-6 py-2.5 rounded-xl font-bold text-sm border border-orange-200 hover:bg-orange-100 transition-all flex items-center gap-2"
                    >
                        <Tag size={18} /> إضافة عرض صنف
                    </button>
                    <button 
                        onClick={() => { setCouponToEdit(null); setShowCouponModal(true); }}
                        className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center gap-2"
                    >
                        <Gift size={18} /> إنشاء كوبون
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'إجمالي العملاء', value: stats?.total_customers || 0, icon: <Users />, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'نقاط مستبدلة', value: stats?.total_points_redeemed || 0, icon: <Award />, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'كوبونات مستخدمة', value: stats?.coupons_used_count || 0, icon: <Ticket />, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { 
                        label: 'متوسط الإنفاق/عميل', 
                        value: `${(Array.isArray(customers) && customers.length > 0 
                            ? (customers.reduce((a, b) => a + Number(b.total_spent || 0), 0) / customers.length) 
                            : 0).toFixed(0)} ج.م`, 
                        icon: <TrendingUp />, 
                        color: 'text-green-600', 
                        bg: 'bg-green-50' 
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-black text-slate-800 mt-1">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* PRODUCT OFFERS SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Flame size={18} className="text-orange-500" /> عروض الأصناف النشطة
                    </h3>
                </div>
                
                {offers.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">لا توجد عروض منتجات مسجلة حالياً.</div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {offers.map(offer => (
                            <div key={offer.id} className="border border-slate-100 rounded-2xl p-4 relative group hover:border-orange-200 transition-all">
                                <span className={`absolute top-4 left-4 w-3 h-3 rounded-full ${offer.is_currently_active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-slate-300'}`}></span>
                                <h4 className="font-black text-lg text-slate-800 mb-1 pr-4">{offer.name ? `${offer.name} (${offer.product_name})` : offer.product_name}</h4>
                                
                                <div className="space-y-2 mb-4 mt-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold">-{Number(offer.discount_percentage).toFixed(0)}%</span>
                                        <span className="text-slate-400 line-through text-xs font-bold">{Number(offer.product_price).toFixed(0)} ج.م</span>
                                        <span className="text-slate-800 font-black">{Number(offer.discounted_price).toFixed(0)} ج.م</span>
                                    </div>
                                    {offer.points_multiplier > 1 && (
                                        <div className="text-xs font-bold text-yellow-600 flex items-center gap-1">
                                            <Star size={12} className="fill-yellow-600" /> نقاط ×{Number(offer.points_multiplier)}
                                        </div>
                                    )}
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Clock size={12} /> ينتهي: {new Date(offer.end_date).toLocaleDateString()}
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 pt-3 border-t border-slate-50">
                                    <button 
                                        onClick={() => handleToggleProductOffer(offer.id)}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${offer.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                    >
                                        {offer.is_active ? 'إيقاف' : 'تفعيل'}
                                    </button>
                                    <button 
                                        onClick={() => { setOfferToEdit(offer); setShowOfferModal(true); }}
                                        className="p-1.5 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-200 transition-all"
                                        title="تعديل العرض"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteOffer(offer.id, offer.product_name)}
                                        className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                                        title="حذف العرض"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* COUPONS SECTION */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Ticket size={18} className="text-orange-500" /> الكوبونات المتاحة
                    </h3>
                </div>
                
                {coupons.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">لا توجد كوبونات مسجلة حالياً.</div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-right" dir="rtl">
                        {coupons.map(coupon => (
                            <div key={coupon.id} className="border border-slate-100 rounded-2xl p-4 relative group hover:border-orange-200 transition-all">
                                <span className={`absolute top-4 left-4 w-3 h-3 rounded-full ${coupon.is_active && !coupon.used_at && new Date(coupon.valid_until) > new Date() ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-slate-300'}`}></span>
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-black text-lg text-slate-800 uppercase tracking-widest">{coupon.code}</h4>
                                    {coupon.used_at && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">مستخدم</span>}
                                </div>
                                
                                <div className="space-y-2 mb-4 mt-3">
                                    <div className="flex items-center gap-2 text-sm justify-end">
                                        <span className="text-slate-800 font-black">
                                            {coupon.discount_type === 'percentage' ? `${Number(coupon.discount_amount).toFixed(0)}%` : `${Number(coupon.discount_amount).toFixed(2)} ج.م`}
                                        </span>
                                        <span className="text-slate-500 text-xs">قيمة الخصم:</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold justify-end flex">
                                        حد أدنى: {Number(coupon.min_purchase).toFixed(0)} ج.م
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                                        صالح لغاية: {new Date(coupon.valid_until).toLocaleDateString()} <Clock size={10} />
                                    </div>
                                    {coupon.customer_name && (
                                        <div className="text-[10px] text-orange-600 font-black justify-end flex">
                                            خاص بـ: {coupon.customer_name}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex gap-2 pt-3 border-t border-slate-50">
                                    <button 
                                        onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                                        disabled={coupon.used_at}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${coupon.used_at ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : (coupon.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100')}`}
                                    >
                                        {coupon.is_active ? 'إيقاف' : 'تفعيل'}
                                    </button>
                                    <button 
                                        onClick={() => { setCouponToEdit(coupon); setShowCouponModal(true); }}
                                        className="p-1.5 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-200 transition-all"
                                        title="تعديل الكوبون"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteCoupon(coupon.id, coupon.code)}
                                        className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                                        title="حذف الكوبون"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ranking Tables */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Star size={18} className="text-yellow-500" /> كبار العملاء (الأكثر إنفاقاً)
                            </h3>
                            <button 
                                onClick={() => setShowAllTopCustomers(!showAllTopCustomers)}
                                className="text-orange-500 text-xs font-bold hover:underline"
                            >
                                {showAllTopCustomers ? 'عرض الأهم فقط' : 'عرض الكل'}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">العميل</th>
                                        <th className="px-6 py-4">زيارات</th>
                                        <th className="px-6 py-4">نقاط</th>
                                        <th className="px-6 py-4">إجمالي الإنفاق</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {(showAllTopCustomers 
                                        ? [...customers].sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0))
                                        : (stats?.highest_spending || [])
                                    ).map((customer) => (
                                        <tr key={customer.id} className="hover:bg-slate-50 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                                                        {customer.name?.substring(0, 1) || '?'}
                                                    </div>
                                                    <div 
                                                        className="cursor-pointer group/name"
                                                        onClick={() => {
                                                            setSelectedCustomerForPoints(customer);
                                                            setShowPointsModal(true);
                                                        }}
                                                    >
                                                        <p className="text-sm font-bold text-slate-800 group-hover/name:text-orange-600 transition-colors">{customer.name}</p>
                                                        <p className="text-[10px] text-slate-400">{customer.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600">{customer.visits ?? '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-yellow-100">
                                                    {customer.points_balance || 0} نقطة
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 text-sm">{Number(customer.total_spent || 0).toFixed(2)} ج.م</td>
                                            <td className="px-6 py-4 text-left">
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-orange-500 transition-all translate-x-1" />
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats?.highest_spending || stats.highest_spending.length === 0) && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-slate-400 text-sm">
                                                لا يوجد عملاء لعرضهم حالياً.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar Cards */}
                <div className="space-y-6">
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
                        <Gift className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                        <h3 className="text-xl font-bold mb-2">
                            {activeCampaign ? (activeCampaign.is_active ? 'إحصائيات الحملة 🛑' : 'حملة متوقفة ⏳') : 'أطلق حملة ترقية! 🚀'}
                        </h3>
                        {activeCampaign && (
                            <div className="mb-4 text-right" dir="rtl">
                                <p className="text-orange-500 font-black text-sm uppercase tracking-wider">{activeCampaign.name}</p>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400">تنتهي: {new Date(activeCampaign.end_date).toLocaleDateString()}</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold">x{activeCampaign.multiplier} نقاط</span>
                                </div>
                            </div>
                        )}
                        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                            {activeCampaign 
                                ? (activeCampaign.is_active 
                                    ? `عرض "${activeCampaign.name}" نشط بنسبة نقاط x${activeCampaign.multiplier}.`
                                    : `حملة "${activeCampaign.name}" مسجلة ولكنها غير مفعلة حالياً.`)
                                : 'قم بمضاعفة النقاط لزيادة عدد الزيارات خلال أوقات الذروة.'}
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={activeCampaign ? confirmCampaignToggle : handleActivateOffer}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                                    activeCampaign?.is_active 
                                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                                        : 'bg-white text-slate-900 hover:bg-orange-500 hover:text-white'
                                }`}
                            >
                                {activeCampaign ? (activeCampaign.is_active ? 'إيقاف الحملة' : 'تفعيل الحملة') : 'إنشاء حملة الآن'}
                            </button>
                            {activeCampaign && (
                                <button 
                                    onClick={() => setShowCampaignModal(true)}
                                    className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                                    title="تعديل بيانات الحملة"
                                >
                                    <Edit2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>


                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-green-500" /> رؤى العملاء
                        </h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-[11px] text-blue-700 font-bold mb-1">العملاء الجدد (آخر 30 يوم)</p>
                                <p className="text-xl font-black text-blue-900">{customers.filter(c => new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                <p className="text-[11px] text-purple-700 font-bold mb-1">متوسط تكرار الزيارة</p>
                                <p className="text-xl font-black text-purple-900">2.4 <span className="text-xs font-normal">مرة/شهر</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals & Notifications */}
            <CouponModal 
                isOpen={showCouponModal} 
                onClose={() => setShowCouponModal(false)}
                onSave={handleSaveCoupon}
                customers={customers}
                couponToEdit={couponToEdit}
            />

            <CampaignModal 
                isOpen={showCampaignModal}
                onClose={() => setShowCampaignModal(false)}
                onConfirm={handleConfirmCampaign}
                currentCampaign={activeCampaign}
            />

            <ProductOfferModal 
                isOpen={showOfferModal}
                onClose={() => setShowOfferModal(false)}
                onSave={fetchLoyaltyData}
                offerToEdit={offerToEdit}
                menuItems={menuItems}
            />

            <CustomerPointsModal 
                isOpen={showPointsModal}
                onClose={() => setShowPointsModal(false)}
                customer={selectedCustomerForPoints}
            />

            {notification && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm ${
                        notification.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'
                    }`}>
                        {notification.type === 'success' ? <CheckCircle2 size={18} className="text-green-400" /> : <XCircle size={18} />}
                        {notification.message}
                    </div>
                </div>
            )}
        </div>
    );
}
