import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { publicApi } from '../api/publicApi';
import { notificationUtil } from '../api/notifications';
import { Package, ChefHat, Truck, CheckCircle2, Search, Loader2, Home, AlertCircle, Utensils, Star, Ticket } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { restaurantPath, useRestaurantSlug } from '../restaurantContext';

const TrackingPage = () => {
    const restaurantSlug = useRestaurantSlug();
    const [searchParams] = useSearchParams();
    const [orderNumber, setOrderNumber] = useState((searchParams.get('order') || '').toUpperCase());
    const [phone, setPhone] = useState(searchParams.get('phone') || '');
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searching, setSearching] = useState(false);
    const { clearSession } = useSessionStore();

    const lastStatus = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (orderNumber && phone) {
            handleTrack();
        }

        // Request notification permission on first load
        notificationUtil.requestPermission();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    // WebSocket for real-time updates
    useEffect(() => {
        if (!order || ['served', 'cancelled', 'delivered'].includes(order.status)) {
            if (socketRef.current) socketRef.current.close();
            return;
        }

        const connectWebSocket = () => {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const protocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
            const wsDomain = apiBase.replace(/^https?:\/\//, '');
            const wsUrl = `${protocol}//${wsDomain}/ws/public/${restaurantSlug}/orders/${order.order_number}/?phone=${encodeURIComponent(phone)}`;

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onmessage = (event) => {
                const updatedOrder = JSON.parse(event.data);
                
                // Show notifications if status changed
                if (lastStatus.current && lastStatus.current !== updatedOrder.delivery_status) {
                    if (updatedOrder.delivery_status === 'out_for_delivery') {
                        notificationUtil.show('الطلب في الطريق! 🛵', `طلبك رقم ${updatedOrder.order_number} خرج للتوصيل الآن.`);
                    } else if (updatedOrder.delivery_status === 'delivered') {
                        notificationUtil.show('بالهنا والشفا! ✅', `تم توصيل طلبك بنجاح.`);
                    }
                }

                lastStatus.current = updatedOrder.delivery_status;
                setOrder(updatedOrder);

                // Clear session if order is finished
                if (['served', 'delivered'].includes(updatedOrder.status)) {
                    clearSession();
                    ws.close();
                }
            };

            ws.onclose = () => {
                // Potential reconnection logic if needed
                console.log('Tracking WebSocket closed');
            };

            ws.onerror = (err) => {
                console.error('Tracking WebSocket error:', err);
            };
        };

        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
        }

        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, [order?.order_number]);

    const handleTrack = async (e) => {
        if (e) e.preventDefault();
        if (!orderNumber || !phone) return;

        setSearching(true);
        setError('');
        try {
            const response = await publicApi.trackOrder(restaurantSlug, orderNumber, phone);
            setOrder(response.data);
            lastStatus.current = response.data.delivery_status;
        } catch (err) {
            setError('لم نتمكن من العثور على الطلب. تأكد من رقم الطلب والهاتف.');
            setOrder(null);
        } finally {
            setSearching(false);
        }
    };

    const getStatusSteps = () => {
        if (order?.order_type === 'delivery') {
            return [
                { key: 'pending', label: 'قيد الانتظار', icon: <Package className="w-6 h-6" /> },
                { key: 'preparing', label: 'تحت التجهيز', icon: <ChefHat className="w-6 h-6" /> },
                { key: 'out_for_delivery', label: 'في الطريق', icon: <Truck className="w-6 h-6" /> },
                { key: 'delivered', label: 'تم التوصيل', icon: <CheckCircle2 className="w-6 h-6" /> },
            ];
        }
        return [
            { key: 'pending', label: 'بانتظار التأكيد', icon: <Package className="w-6 h-6" /> },
            { key: 'preparing', label: 'في المطبخ', icon: <ChefHat className="w-6 h-6" /> },
            { key: 'ready', label: 'جاهز للاستلام', icon: <Utensils className="w-6 h-6" /> },
            { key: 'served', label: 'بالهنا والشفا', icon: <CheckCircle2 className="w-6 h-6" /> },
        ];
    };

    const getCurrentStepIndex = (steps) => {
        if (!order) return -1;
        const status = order.status;
        const subStatus = order.delivery_status || 'pending';

        if (order.order_type === 'delivery') {
            if (subStatus === 'delivered' || status === 'delivered') return 3;
            if (subStatus === 'out_for_delivery' || status === 'out_for_delivery') return 2;
            if (['preparing', 'confirmed', 'in_kitchen'].includes(subStatus) || ['confirmed', 'in_kitchen'].includes(status)) return 1;
            return 0;
        } else {
            if (['served', 'paid', 'delivered'].includes(status)) return 3;
            if (status === 'ready') return 2;
            if (['confirmed', 'in_kitchen', 'preparing', 'confirmed'].includes(status)) return 1;
            return 0;
        }
    };

    return (
        <div className="max-container px-4 md:px-8 py-10">
            <div className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-extrabold mb-10 dark:text-white text-center">تتبع طلبك</h2>

                {/* Search Box */}
                <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-neutral-800 shadow-sm mb-12">
                    <form onSubmit={handleTrack} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-2">
                            <input
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                                placeholder="رقم الطلب (ORD-...)"
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white uppercase"
                            />
                        </div>
                        <div className="flex-1">
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="رقم الجوال"
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-primary-500 dark:text-white"
                            />
                        </div>
                        <button
                            disabled={searching}
                            className="px-8 py-4 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            تتبع
                        </button>
                    </form>
                    {error && <p className="text-red-500 mt-4 text-sm font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
                </div>

                {/* Order Details */}
                {order && (
                    <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
                        {/* Horizontal Timeline */}
                        <div className="bg-white dark:bg-neutral-900 p-10 rounded-[3rem] border border-gray-100 dark:border-neutral-800 shadow-xl mb-8">
                            <div className="flex justify-between relative mb-12">
                                {/* Connecting Line */}
                                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 dark:bg-neutral-800 -translate-y-1/2 z-0" />
                                <div
                                    className="absolute top-1/2 right-0 h-1 bg-primary-500 -translate-y-1/2 z-0 transition-all duration-1000"
                                    style={{ width: `${(getCurrentStepIndex(getStatusSteps()) / (getStatusSteps().length - 1)) * 100}%` }}
                                />

                                {getStatusSteps().map((step, idx) => (
                                    <div key={step.key} className="relative z-10 flex flex-col items-center gap-3">
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${idx <= getCurrentStepIndex(getStatusSteps())
                                            ? 'bg-primary-500 border-white dark:border-neutral-900 text-white shadow-lg shadow-primary-500/30'
                                            : 'bg-gray-100 dark:bg-neutral-800 border-white dark:border-neutral-900 text-gray-400'
                                            }`}>
                                            {step.icon}
                                        </div>
                                        <span className={`text-xs font-black whitespace-nowrap ${idx <= getCurrentStepIndex(getStatusSteps()) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="h-[1px] bg-gray-100 dark:bg-neutral-800 mb-8" />

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                                <div>
                                    <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-widest">رقم الطلب</p>
                                    <p className="text-xl font-black dark:text-white pb-6">{order.order_number}</p>
                                </div>
                                {order.order_type === 'delivery' && (
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-widest">التوصيل</p>
                                        <p className="text-xl font-black text-primary-500">{order.delivery_fee} جنيه</p>
                                    </div>
                                )}
                                {order.coupon_code && (
                                    <div>
                                        <p className="text-xs text-orange-400 font-bold mb-1 uppercase tracking-widest flex items-center justify-center gap-1"><Ticket size={14} /> كوبون</p>
                                        <p className="text-xl font-black text-orange-500">{order.coupon_code}</p>
                                    </div>
                                )}
                                {(order.loyalty_points_earned > 0 || order.used_points > 0) && (
                                    <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-800">
                                        <p className="text-xs text-orange-600 font-bold mb-2 uppercase tracking-widest flex items-center justify-center gap-1"><Star size={14} /> نقاط الولاء</p>
                                        {order.loyalty_points_earned > 0 && <p className="text-sm font-black text-green-600">+{Math.floor(order.loyalty_points_earned)} مكتسبة</p>}
                                        {order.used_points > 0 && <p className="text-sm font-black text-red-500">-{order.used_points} مستخدمة</p>}
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-widest">الإجمالي النهائى</p>
                                    <p className="text-xl font-black text-primary-500">{order.total} جنيه</p>
                                </div>
                            </div>
                        </div>

                        <Link to={restaurantPath(restaurantSlug)} className="flex items-center justify-center gap-2 text-primary-500 font-bold hover:underline">
                            <Home className="w-5 h-5" /> العودة للرئيسية
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrackingPage;
