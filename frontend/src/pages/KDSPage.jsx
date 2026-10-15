import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Clock, CheckCircle2, AlertCircle, Timer, ChefHat } from 'lucide-react';

export default function KDSPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        fetchKDSOrders();

        let ws = null;
        let reconnectTimeout = null;

        const connectWebSocket = () => {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const isSecure = apiBase.startsWith('https') || window.location.protocol === 'https:';
            const protocol = isSecure ? 'wss:' : 'ws:';
            
            // Clean the protocol from the base URL to get the domain
            const wsDomain = apiBase.replace(/^https?:\/\//, '');
            const wsUrl = `${protocol}//${wsDomain}/ws/kds/`;
            
            const token = localStorage.getItem('access_token');
            
            // Pass token in subprotocol to hide it from the URL/Console logs
            ws = new WebSocket(wsUrl, token ? ['token', token] : undefined);



            ws.onopen = () => {
                setConnected(true);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleOrderUpdate(data);
            };

            ws.onerror = (err) => {
                // Ignore WebSocket errors when trying to close on unmount (React Strict Mode)
                if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return;
                console.error('WebSocket error', err);
            };

            ws.onclose = () => {
                setConnected(false);
                // Try reconnecting after 3 seconds if disconnected
                reconnectTimeout = setTimeout(connectWebSocket, 3000);
            };
        };

        connectWebSocket();

        return () => {
            clearTimeout(reconnectTimeout);
            if (ws) {
                // Remove listeners to prevent errors during Strict Mode unmount
                ws.onerror = null;
                ws.onclose = null;
                ws.close();
            }
        };
    }, []);

    const fetchKDSOrders = async () => {
        try {
            const res = await api.get('/orders/');
            // Filter only active orders for KDS
            setOrders(res.data.filter(o => ['pending', 'confirmed', 'in_kitchen', 'ready'].includes(o.status)));
        } catch (err) {
            console.error('Error fetching KDS orders', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOrderUpdate = (data) => {
        setOrders(prev => {
            const index = prev.findIndex(o => o.id === data.id);
            if (index !== -1) {
                // If order status became final, remove it
                if (['served', 'paid', 'cancelled', 'delivered'].includes(data.status)) {
                    return prev.filter(o => o.id !== data.id);
                }
                const newOrders = [...prev];
                newOrders[index] = { ...newOrders[index], ...data };
                return newOrders;
            } else if (['pending', 'confirmed', 'in_kitchen', 'ready'].includes(data.status)) {
                // Check if it's already there (to avoid duplicates if state updates manually)
                return [data, ...prev.filter(o => o.id !== data.id)];
            }
            return prev;
        });
    };

    const advanceStatus = async (id) => {
        try {
            await api.post(`/orders/${id}/next_status/`);
            // Optimistic manual refresh if WS is slow or disconnected
            fetchKDSOrders();
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message;
            alert(`فشل تحديث الحالة: ${errorMsg}`);
        }

    };

    if (loading) return <div className="p-10 text-center">جاري تحميل شاشة المطبخ...</div>;

    return (
        <div className="space-y-6 h-full flex flex-col p-4 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        شاشة المطبخ الذكية <ChefHat size={32} className="text-orange-500" />
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {connected ? 'اتصال مباشر' : 'فشل الاتصال - جاري المحاولة'}
                        </span>
                    </div>

                </div>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-200 animate-pulse"></div>
                            <span className="text-xs font-black text-slate-600">عاجل جداً</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-200"></div>
                            <span className="text-xs font-black text-slate-600">متأخر</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-200"></div>
                            <span className="text-xs font-black text-slate-600">جاهز</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-2xl border border-green-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                        <span className="text-xs font-black uppercase tracking-wider">Live Connection</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-10 custom-scrollbar">
                {orders.sort((a, b) => {
                    // Sort by priority first (URGENT > HIGH > NORMAL), then by age
                    const priorityScore = { 'URGENT': 3, 'HIGH': 2, 'NORMAL': 1 };
                    const diff = priorityScore[b.priority_level] - priorityScore[a.priority_level];
                    if (diff !== 0) return diff;
                    return new Date(a.created_at) - new Date(b.created_at);
                }).map(order => (
                    <OrderCard key={order.id} order={order} onAdvance={() => advanceStatus(order.id)} />
                ))}
                
                {orders.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-300">
                        <div className="p-8 bg-slate-50 rounded-full mb-6">
                            <ChefHat size={80} className="opacity-20" />
                        </div>
                        <p className="text-2xl font-black uppercase tracking-widest">لا توجد طلبات جارية</p>
                        <p className="text-sm font-bold mt-2">استرح قليلاً، المطبخ جاهز لاستقبال الجديد</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function OrderCard({ order, onAdvance }) {
    const priorityStyles = {
        URGENT: 'border-red-500 ring-4 ring-red-500/10 shadow-red-100',
        HIGH: 'border-orange-400 ring-4 ring-orange-500/5 shadow-orange-100',
        NORMAL: 'border-slate-100 shadow-slate-100'
    };

    const statusColors = {
        pending: 'bg-yellow-500',
        confirmed: 'bg-indigo-500',
        in_kitchen: 'bg-purple-600',
        ready: 'bg-emerald-500',
    };

    const statusGradients = {
        pending: 'from-yellow-400 to-yellow-600',
        confirmed: 'from-indigo-400 to-indigo-600',
        in_kitchen: 'from-purple-500 to-purple-700',
        ready: 'from-emerald-400 to-emerald-600',
    };

    return (
        <div className={`group bg-white rounded-[2rem] border-2 overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 h-fit ${priorityStyles[order.priority_level]}`}>
            {/* Header with gradient status */}
            <div className={`h-3 bg-gradient-to-r ${statusGradients[order.status] || 'from-slate-400 to-slate-500'} shadow-inner`}></div>
            
            <div className="p-6 space-y-5">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-3xl font-black text-slate-900 leading-none">#{order.daily_id}</span>
                            {order.priority_level === 'URGENT' && (
                                <span className="p-1.5 bg-red-100 text-red-600 rounded-lg animate-bounce">
                                    <AlertCircle size={18} />
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase letter-spacing-widest">
                                {order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.order_type_display}
                            </div>
                            {order.priority_level !== 'NORMAL' && (
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${order.priority_level === 'URGENT' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                                    {order.priority_level === 'URGENT' ? 'عاجل جداً' : 'متأخر'}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-black text-slate-500 border border-slate-100">
                            <Timer size={14} className={order.priority_level === 'URGENT' ? 'text-red-500' : ''} />
                            <span>{order.waiting_time} دقيقة</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">{new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </div>

                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    {order.items.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 border-b border-slate-200/50 last:border-0 pb-2 last:pb-0">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-black text-slate-800 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px]">{item.quantity}</span>
                                    {item.menu_item_details?.name || item.name}
                                </span>
                            </div>
                            {item.notes && (
                                <div className="flex items-center gap-1.5 text-xs font-black text-red-600 bg-red-50 p-2 rounded-xl mt-1 border border-red-100/50">
                                    <AlertCircle size={14} />
                                    <span>ملاحظة: {item.notes}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {order.notes && (
                    <div className="flex items-start gap-2 bg-indigo-50 p-4 rounded-2xl text-[11px] font-bold text-indigo-900 border border-indigo-100/50 leading-relaxed shadow-inner">
                        <Clock size={16} className="text-indigo-500 mt-0.5" />
                        <div>
                            <span className="block text-[10px] uppercase text-indigo-400 mb-1">تعليمات خاصة</span>
                            {order.notes}
                        </div>
                    </div>
                )}

                <button
                    onClick={onAdvance}
                    className={`w-full py-5 rounded-2xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-3 shadow-xl active:scale-95 group
                        ${order.status === 'ready'
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 text-white shadow-emerald-200'
                            : 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-slate-200 hover:from-orange-500 hover:to-orange-700 hover:shadow-orange-200'}`}
                >
                    {order.status === 'ready' ? 'إخطار العميل / الويتر' : 'نقل للمرحلة التالية'}
                    <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
                        <CheckCircle2 size={18} />
                    </div>
                </button>
            </div>
        </div>
    );
}
