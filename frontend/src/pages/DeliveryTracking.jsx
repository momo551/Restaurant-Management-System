import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    Truck,
    Search,
    Clock,
    Phone,
    MapPin,
    User,
    RefreshCw,
    ChevronRight,
    Package,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
} from 'lucide-react';

// ─── Status configuration ──────────────────────────────────────────────────────
const DELIVERY_STATUSES = [
    { id: 'all', label: 'الكل', color: 'slate' },
    { id: 'pending', label: 'قيد الانتظار', color: 'yellow' },
    { id: 'preparing', label: 'جاري التحضير', color: 'blue' },
    { id: 'out_for_delivery', label: 'خرج للتوصيل', color: 'purple' },
    { id: 'delivered', label: 'تم التوصيل', color: 'green' },
    { id: 'cancelled', label: 'ملغي', color: 'red' },
];

const STATUS_STYLE = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400', border: 'border-yellow-200' },
    preparing: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-400', border: 'border-blue-200' },
    out_for_delivery: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200' },
    delivered: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400', border: 'border-red-200' },
};

const NEXT_STATUS_LABEL = {
    pending: 'بدء التحضير',
    preparing: 'إرسال للتوصيل',
    out_for_delivery: 'تم التوصيل',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' });
}

function minutesLeft(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / 60000);
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, colorClass }) {
    return (
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-black text-slate-800">{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
            </div>
        </div>
    );
}

// ─── Order Row ────────────────────────────────────────────────────────────────
function OrderRow({ order, onAdvance, onCancel, advancing, onUpdateAgentName }) {
    const [isEditingAgent, setIsEditingAgent] = useState(false);
    const [tempAgentName, setTempAgentName] = useState(order.delivery_agent_name || '');
    const style = STATUS_STYLE[order.delivery_status] || STATUS_STYLE.pending;
    const mins = minutesLeft(order.estimated_delivery_at);
    const isLate = mins !== null && mins < 0 &&
        !['delivered', 'cancelled'].includes(order.delivery_status);

    return (
        <tr className="hover:bg-slate-50 transition-colors group">
            {/* Order number */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-black text-orange-500 text-lg leading-none">#{order.daily_id}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{order.order_number}</div>
            </td>

            {/* Customer */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm shrink-0">
                        {(order.customer_name || 'ع')[0]}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-800 text-sm">{order.customer_name || '—'}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Phone size={10} /> {order.customer_phone || '—'}
                        </p>
                    </div>
                </div>
            </td>

            {/* Address */}
            <td className="px-4 py-3 max-w-[180px]">
                <p className="text-sm text-slate-600 flex items-start gap-1">
                    <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{order.delivery_address || '—'}</span>
                </p>
            </td>

            {/* Agent */}
            <td className="px-4 py-3 whitespace-nowrap">
                {isEditingAgent ? (
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            className="w-24 px-2 py-1 text-xs border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 outline-none"
                            value={tempAgentName}
                            onChange={(e) => setTempAgentName(e.target.value)}
                            autoFocus
                        />
                        <button
                            onClick={() => {
                                onUpdateAgentName(order.id, tempAgentName);
                                setIsEditingAgent(false);
                            }}
                            className="bg-orange-500 text-white p-1 rounded hover:bg-orange-600"
                        >
                            <CheckCircle2 size={12} />
                        </button>
                        <button
                            onClick={() => {
                                setIsEditingAgent(false);
                                setTempAgentName(order.delivery_agent_name || '');
                            }}
                            className="bg-slate-200 text-slate-500 p-1 rounded hover:bg-slate-300"
                        >
                            <XCircle size={12} />
                        </button>
                    </div>
                ) : (
                    <p
                        className="text-sm text-slate-700 flex items-center gap-1 cursor-pointer hover:text-orange-600 transition-colors"
                        onClick={() => setIsEditingAgent(true)}
                        title="نقر لتعديل اسم المندوب"
                    >
                        <User size={13} className="text-slate-400" />
                        {order.delivery_agent_name || <span className="text-slate-300 italic">غير محدد</span>}
                    </p>
                )}
            </td>

            {/* Times */}
            <td className="px-4 py-3 whitespace-nowrap text-center">
                <div className="text-xs text-slate-500 flex items-center gap-1 justify-center">
                    <Clock size={11} /> {formatDate(order.created_at)} {formatTime(order.created_at)}
                </div>
                {order.estimated_delivery_at && (
                    <div className={`text-xs font-bold mt-1 flex items-center gap-1 justify-center
                        ${isLate ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                        <Truck size={11} />
                        {isLate
                            ? `متأخر ${Math.abs(mins)} د`
                            : mins !== null && !['delivered', 'cancelled'].includes(order.delivery_status)
                                ? `خلال ${mins} د`
                                : formatTime(order.estimated_delivery_at)}
                    </div>
                )}
            </td>

            {/* Total */}
            <td className="px-4 py-3 whitespace-nowrap text-center">
                <span className="font-bold text-slate-800">{Number(order.total).toFixed(0)}</span>
                <span className="text-xs text-slate-400 mr-1">ج.م</span>
            </td>

            {/* Status */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
                        ${style.bg} ${style.text} ${style.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {order.delivery_status_display}
                    </span>
                    {order.status === 'paid' && (
                        <span className="inline-flex items-center justify-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={10} />
                            مدفوع
                        </span>
                    )}
                </div>
            </td>

            {/* Actions */}
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                    {/* Show "Send for Delivery" only when kitchen is finished (ready/served) and it's not yet out for delivery */}
                    {(['ready', 'served'].includes(order.status) && ['pending', 'preparing'].includes(order.delivery_status)) && (
                        <button
                            onClick={() => onAdvance(order.id, 'out_for_delivery')}
                            disabled={advancing === order.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {advancing === order.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Truck size={12} />}
                            ارسال للتوصيل
                        </button>
                    )}

                    {/* Admin can still cancel if needed, but 'Delivered' belongs to the Agent Dashboard */}
                    {!['cancelled', 'delivered'].includes(order.delivery_status) && (
                        <button
                            onClick={() => onCancel(order.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="إلغاء الطلب"
                        >
                            <XCircle size={16} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeliveryTracking() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [search, setSearch] = useState('');
    const [advancing, setAdvancing] = useState(null); // order id being advanced
    const [lastSync, setLastSync] = useState(null);

    // ── fetch ──
    const fetchOrders = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const res = await api.get('/orders/delivery_orders/');
            setOrders(res.data);
            setLastSync(new Date());
        } catch (err) {
            console.error('Error fetching delivery orders', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders(true);
        const interval = setInterval(() => fetchOrders(false), 15000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    // ── advance delivery status ──
    const handleAdvance = async (id, status = null) => {
        setAdvancing(id);
        try {
            await api.post(`/orders/${id}/update_delivery_status/`, status ? { delivery_status: status } : {});
            fetchOrders(false);
        } catch (err) {
            alert('فشل تحديث حالة التوصيل');
        } finally {
            setAdvancing(null);
        }
    };

    // ── cancel delivery ──
    const handleCancel = async (id) => {
        if (!window.confirm('هل تريد إلغاء هذا الطلب؟')) return;
        try {
            await api.post(`/orders/${id}/update_delivery_status/`, {
                delivery_status: 'cancelled',
            });
            fetchOrders(false);
        } catch (err) {
            alert('فشل إلغاء الطلب');
        }
    };

    // ── update agent name ──
    const handleUpdateAgentName = async (id, name) => {
        try {
            await api.patch(`/orders/${id}/`, {
                delivery_agent_name: name,
            });
            fetchOrders(false);
        } catch (err) {
            alert('فشل تحديث اسم المندوب');
        }
    };

    // ── derived data ──
    const filtered = orders.filter(o => {
        const matchTab = activeTab === 'all' || o.delivery_status === activeTab;
        const matchSearch = !search.trim() ||
            o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
            o.customer_phone?.includes(search) ||
            o.order_number?.toLowerCase().includes(search.toLowerCase());
        return matchTab && matchSearch;
    });

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.delivery_status === 'pending').length,
        preparing: orders.filter(o => o.delivery_status === 'preparing').length,
        out_for_delivery: orders.filter(o => o.delivery_status === 'out_for_delivery').length,
        delivered: orders.filter(o => o.delivery_status === 'delivered').length,
    };

    // ── render ──
    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-orange-500" size={26} />
                        متابعة الدليفري
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        تتبع جميع طلبات التوصيل في الوقت الفعلي
                        {lastSync && (
                            <span className="mr-2 text-slate-400">
                                · آخر تحديث: {formatTime(lastSync)}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => fetchOrders(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm transition-all self-start"
                >
                    <RefreshCw size={15} />
                    تحديث
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<Package size={22} className="text-slate-600" />}
                    label="إجمالي الطلبات"
                    value={stats.total}
                    colorClass="bg-slate-100"
                />
                <StatCard
                    icon={<Clock size={22} className="text-yellow-600" />}
                    label="قيد الانتظار / التحضير"
                    value={stats.pending + stats.preparing}
                    colorClass="bg-yellow-50"
                />
                <StatCard
                    icon={<Truck size={22} className="text-purple-600" />}
                    label="خرج للتوصيل"
                    value={stats.out_for_delivery}
                    colorClass="bg-purple-50"
                />
                <StatCard
                    icon={<CheckCircle2 size={22} className="text-green-600" />}
                    label="تم التوصيل اليوم"
                    value={stats.delivered}
                    colorClass="bg-green-50"
                />
            </div>

            {/* Search + Filter Row */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث باسم العميل، رقم التليفون، أو رقم الطلب..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {DELIVERY_STATUSES.map(tab => {
                    const count = tab.id === 'all'
                        ? orders.length
                        : orders.filter(o => o.delivery_status === tab.id).length;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all border
                                ${activeTab === tab.id
                                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-600'}`}
                        >
                            {tab.label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                                ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Loader2 size={32} className="animate-spin text-orange-400" />
                        <p>جاري تحميل الطلبات...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Truck size={48} className="text-slate-200" />
                        <p className="font-medium">لا توجد طلبات دليفري في هذه الفئة</p>
                        <p className="text-xs">جرّب تغيير الفلتر أو البحث</p>
                    </div>
                ) : (
                    <table className="w-full text-sm" dir="rtl">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">رقم</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">العميل</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">العنوان</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">المندوب</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">التوقيت</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">الإجمالي</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">الحالة</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wide">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(order => (
                                <OrderRow
                                    key={order.id}
                                    order={order}
                                    onAdvance={handleAdvance}
                                    onCancel={handleCancel}
                                    advancing={advancing}
                                    onUpdateAgentName={handleUpdateAgentName}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
