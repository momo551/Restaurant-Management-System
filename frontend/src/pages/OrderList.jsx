import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    Clock,
    CheckCircle2,
    ArrowRight,
    Timer,
    AlertCircle,
    MoreVertical,
    ChevronRight,
    Edit,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OrderList() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [processingOrders, setProcessingOrders] = useState(new Set());
    const [openMenuId, setOpenMenuId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
        // Poll for updates every 10 seconds for real-time countdown
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await api.get('/orders/');
            setOrders(res.data);
        } catch (err) {
            console.error('Error fetching orders', err);
        } finally {
            setLoading(false);
        }
    };

    const advanceStatus = async (id) => {
        if (processingOrders.has(id)) return;
        setProcessingOrders(prev => new Set(prev).add(id));
        try {
            await api.post(`/orders/${id}/next_status/`);
            fetchOrders();
        } catch (err) {
            alert('فشل تحديث الحالة');
        } finally {
            setProcessingOrders(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const holdOrder = async (id) => {
        if (processingOrders.has(id)) return;
        setProcessingOrders(prev => new Set(prev).add(id));
        try {
            await api.post(`/orders/${id}/hold/`);
            fetchOrders();
        } catch (err) {
            alert('فشل إيقاف الطلب');
        } finally {
            setProcessingOrders(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm('هل أنت متأكد من إلغاء وحذف هذا الطلب؟')) return;
        setOpenMenuId(null);
        if (processingOrders.has(id)) return;
        setProcessingOrders(prev => new Set(prev).add(id));
        try {
            await api.delete(`/orders/${id}/delete_order/`);
            fetchOrders();
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'فشل حذف الطلب';
            alert(errorMsg);
        } finally {
            setProcessingOrders(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleEditOrder = (id) => {
        navigate(`/pos?edit=${id}`);
    };

    const statusMap = {
        pending: { label: 'انتظار (موقف)', color: 'bg-yellow-500', next: 'تأكيد للمطبخ' },
        confirmed: { label: 'مؤكد', color: 'bg-blue-500', next: 'للمطبخ' },
        in_kitchen: { label: 'في المطبخ', color: 'bg-purple-500', next: 'جاهز', canHold: true },
        ready: { label: 'جاهز', color: 'bg-green-500', next: 'تم التقديم' },
        out_for_delivery: { label: 'خرج للتوصيل', color: 'bg-orange-600', next: null },
        served: { label: 'تم التقديم', color: 'bg-indigo-500', next: null },
        delivered: { label: 'تم التوصيل', color: 'bg-teal-500', next: null },
        paid: { label: 'تم الدفع', color: 'bg-slate-400', next: null },
        cancelled: { label: 'ملغي', color: 'bg-red-500', next: null },
    };

    const filteredOrders = orders.filter(o => {
        if (activeTab === 'all') return true;
        if (activeTab === 'active') return !['served', 'out_for_delivery', 'delivered', 'paid', 'cancelled'].includes(o.status);
        if (activeTab === 'delivered') return ['delivered', 'served', 'out_for_delivery'].includes(o.status);
        return o.status === activeTab;
    });

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">إدارة الطلبات 🧾</h1>
                    <p className="text-slate-500">تتبع حالة الطلبات من التحضير إلى الدفع.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {[
                    { id: 'active', label: 'طلبات نشطة' },
                    { id: 'pending', label: 'الانتظار' },
                    { id: 'in_kitchen', label: 'المطبخ' },
                    { id: 'ready', label: 'جاهز' },
                    { id: 'delivered', label: 'المستلم (Takeaway)' },
                    { id: 'all', label: 'الكل' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              px-6 py-3 whitespace-nowrap transition-all font-medium border-b-2
              ${activeTab === tab.id
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'}
            `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition-all">
                        <div className={`h-1.5 w-full ${statusMap[order.status]?.color || 'bg-slate-400'}`}></div>
                        <div className="p-5 flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="flex flex-col mb-2">
                                        <span className="text-2xl font-black text-orange-500">#{order.daily_id}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.order_number}</span>
                                    </div>
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        {order.order_type === 'dine_in' ? `طاولة ${order.table_number}` : order.order_type_display}
                                        {order.is_edited && (
                                            <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold">متعدل</span>
                                        )}
                                    </h3>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold text-white ${statusMap[order.status]?.color || 'bg-slate-400'}`}>
                                    {order.status_display}
                                </div>
                            </div>

                            {order.notes && (
                                <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                    <p className="text-[10px] text-orange-800 font-medium">ملاحظات: {order.notes}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm italic">
                                        <span className="text-slate-600">
                                            <span className="font-bold text-slate-800 not-italic ml-2">{item.quantity}x</span>
                                            {item.menu_item_details.name}
                                        </span>
                                        {item.notes && <span className="text-red-400 text-[10px]">({item.notes})</span>}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        <span>بدأ: {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {['pending', 'confirmed', 'in_kitchen'].includes(order.status) && order.estimated_ready_at && (
                                        <div className={`flex items-center gap-1 font-bold ${new Date(order.estimated_ready_at) < new Date() ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                                            <Timer size={12} />
                                            <span>
                                                {new Date(order.estimated_ready_at) < new Date()
                                                    ? 'متأخر!'
                                                    : `جاهز خلال: ${Math.max(0, Math.ceil((new Date(order.estimated_ready_at) - new Date()) / 60000))} د`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    {order.order_type === 'delivery' && (
                                        <div className="text-[10px] text-slate-400 mb-1">
                                            <span>{Number(order.subtotal).toFixed(0)}</span> + <span className="text-orange-500 font-bold">{Number(order.delivery_fee).toFixed(0)}</span> تـوصـيـل
                                        </div>
                                    )}
                                    <div className="font-bold text-slate-800 text-sm">
                                        {Number(order.total).toFixed(2)} ج.م
                                    </div>
                                    {order.estimated_ready_at && (
                                        <div className="text-[10px] text-slate-400">
                                            الاستلام: {new Date(order.estimated_ready_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery hand-off hint */}
                        {order.order_type === 'delivery' && order.status === 'served' && (
                            <div className="mx-5 mb-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2 text-[11px] text-orange-700 font-semibold">
                                <ArrowRight size={13} className="shrink-0" />
                                تابع التوصيل من صفحة <span className="underline">متابعة الدليفري</span>
                            </div>
                        )}

                        <div className="bg-slate-50 p-3 flex gap-2">
                            {statusMap[order.status]?.next && (
                                <button
                                    onClick={() => advanceStatus(order.id)}
                                    disabled={processingOrders.has(order.id)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group border
                                        ${processingOrders.has(order.id)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                            : 'bg-white hover:bg-orange-500 hover:text-white text-slate-600 border-slate-200 hover:border-orange-500'}`}
                                >
                                    {processingOrders.has(order.id) ? 'جاري...' : statusMap[order.status].next}
                                    {!processingOrders.has(order.id) && <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                                </button>
                            )}
                            {statusMap[order.status]?.canHold && (
                                <button
                                    onClick={() => holdOrder(order.id)}
                                    disabled={processingOrders.has(order.id)}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group border
                                        ${processingOrders.has(order.id)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                            : 'bg-white hover:bg-yellow-500 hover:text-white text-slate-600 border-slate-200 hover:border-yellow-500'}`}
                                >
                                    {processingOrders.has(order.id) ? '...' : 'إيقاف مؤقت'}
                                    {!processingOrders.has(order.id) && <Clock size={14} />}
                                </button>
                            )}

                            {/* Actions Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                                    className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center justify-center"
                                >
                                    <MoreVertical size={18} />
                                </button>

                                {openMenuId === order.id && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                                        <div className="absolute left-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20">
                                            {/* Edit is allowed if pending or in_kitchen */}
                                            {['pending', 'in_kitchen'].includes(order.status) && (
                                                <button
                                                    onClick={() => handleEditOrder(order.id)}
                                                    className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <Edit size={14} className="text-blue-500" />
                                                    تعديل الطلب
                                                </button>
                                            )}

                                            {/* Delete is allowed if not paid, served, cancelled, delivered, out_for_delivery */}
                                            {!['paid', 'served', 'completed', 'cancelled', 'delivered', 'out_for_delivery'].includes(order.status) && (
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="w-full px-4 py-2 text-right text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                >
                                                    <Trash2 size={14} />
                                                    إلغاء الطلب
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setOpenMenuId(null)}
                                                className="w-full px-4 py-2 text-right text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                                            >
                                                <AlertCircle size={14} className="text-slate-400" />
                                                تفاصيل إضافية
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {filteredOrders.length === 0 && (
                    <div className="col-span-full py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <ClipboardList size={48} />
                        <p className="font-medium">لا توجد طلبات في هذه الفئة حالياً</p>
                    </div>
                )}
            </div>
        </div >
    );
}

function ClipboardList({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>
    );
}
