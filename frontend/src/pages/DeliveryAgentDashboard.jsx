import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import useStore from '../store/useStore';
import {
    Truck,
    Clock,
    Phone,
    MapPin,
    CheckCircle2,
    Package,
    Navigation,
    Loader2,
    DollarSign,
    RefreshCw,
    LogOut
} from 'lucide-react';

const STATUS_STYLE = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'بانتظار الاستلام' },
    preparing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'جاري التحضير' },
    out_for_delivery: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'في الطريق' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', label: 'تم التوصيل' },
};

export default function DeliveryAgentDashboard() {
    const { user, logout, checkAuth } = useStore();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);

    const fetchOrders = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const res = await api.get('/orders/delivery_orders/');
            setOrders(res.data);
            await checkAuth(); // Refresh user profile (total_commissions)
        } catch (err) {
            console.error('Error fetching agent orders', err);
        } finally {
            setLoading(false);
        }
    }, [checkAuth]);

    useEffect(() => {
        fetchOrders(true);
        const interval = setInterval(() => fetchOrders(false), 30000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const handleUpdateStatus = async (orderId, currentStatus) => {
        setUpdating(orderId);
        try {
            // Auto-advance logic on backend
            await api.post(`/orders/${orderId}/update_delivery_status/`);
            await fetchOrders(false);
        } catch (err) {
            alert('فشل تحديث الحالة');
        } finally {
            setUpdating(null);
        }
    };

    const todayString = new Date().toDateString();
    const activeOrders = orders.filter(o => o.delivery_status !== 'delivered' && o.delivery_status !== 'cancelled');
    const ordersToday = orders.filter(o => new Date(o.created_at).toDateString() === todayString);
    const completedToday = ordersToday.filter(o => o.delivery_status === 'delivered').length;
    const totalEarnings = ordersToday
        .filter(o => o.delivery_status === 'delivered')
        .reduce((sum, o) => sum + Number(o.delivery_commission || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">مرحباً، {user?.first_name || user?.username} 👋</h1>
                    <p className="text-slate-500 mt-1">إليك نظرة سريعة على طلباتك المباشرة وأرباحك.</p>
                </div>
                <button
                    onClick={() => fetchOrders(true)}
                    className="bg-white px-4 py-2 rounded-xl text-slate-600 text-sm font-medium border border-slate-200 shadow-sm hover:bg-slate-50 flex items-center gap-2"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    تحديث
                </button>
            </div>

            {/* Stats Summary Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">طلبات اليوم المسلمة</p>
                        <p className="text-2xl font-bold text-slate-800">{completedToday}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">إجمالي عمولة اليوم</p>
                        <p className="text-2xl font-bold text-slate-800">{totalEarnings.toFixed(2)} ج.م</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">العمولات المتراكمة</p>
                        <p className="text-2xl font-bold text-slate-800">{(Number(user?.total_commissions) || 0).toFixed(2)} ج.م</p>
                    </div>
                </div>
            </div>

            {/* Active Orders Section */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center gap-2">
                    <Truck size={20} className="text-orange-500" />
                    <h2 className="font-bold text-slate-800">الطلبات الحالية والجديدة</h2>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <Loader2 className="animate-spin" />
                        <p className="text-sm font-medium">جاري تحديث الطلبات...</p>
                    </div>
                ) : activeOrders.length === 0 ? (
                    <div className="p-12 text-center space-y-2">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package className="text-slate-300" size={32} />
                        </div>
                        <p className="font-bold text-slate-600">لا توجد طلبات حالية</p>
                        <p className="text-sm text-slate-400">سيتم إشعارك عند تعيين طلب جديد لك أو عند توفر طلبات للاستلام</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
                        {activeOrders.map(order => (
                            <div key={order.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-all overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-black">
                                            #{order.daily_id}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLE[order.delivery_status]?.bg} ${STATUS_STYLE[order.delivery_status]?.text}`}>
                                            {STATUS_STYLE[order.delivery_status]?.label}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                        {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>

                                <div className="p-4 flex-1 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <MapPin size={18} className="text-slate-400 shrink-0 mt-1" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-400 font-bold">العنوان</p>
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                                {order.delivery_address || 'لا يوجد عنوان محدد'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                                                {order.customer_name?.[0] || 'ع'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{order.customer_name || 'عميل'}</p>
                                                <a href={`tel:${order.customer_phone}`} className="text-xs text-orange-500 font-bold flex items-center gap-1">
                                                    <Phone size={12} />
                                                    {order.customer_phone}
                                                </a>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 font-bold">الحساب</p>
                                            <p className="text-lg font-black text-slate-800">
                                                {Number(order.total).toFixed(0)} <span className="text-xs font-normal">ج.م</span>
                                            </p>
                                            {order.delivery_commission > 0 && (
                                                <p className="text-[10px] text-green-600 font-bold mt-1">
                                                    العمولة: {Number(order.delivery_commission).toFixed(2)} ج.م
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white flex gap-2">
                                    <button
                                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`)}
                                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
                                    >
                                        <Navigation size={14} />
                                        الخريطة
                                    </button>

                                    {order.delivery_status === 'out_for_delivery' && (
                                        <button
                                            onClick={() => handleUpdateStatus(order.id, 'out_for_delivery')}
                                            disabled={updating === order.id}
                                            className="flex-[1.5] bg-green-500 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
                                        >
                                            {updating === order.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                            تم التوصيل
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
