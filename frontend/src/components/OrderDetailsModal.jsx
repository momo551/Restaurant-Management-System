import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';
import { ShoppingBag, Calendar, User, Receipt, Tag, Clock } from 'lucide-react';

export default function OrderDetailsModal({ isOpen, onClose, orderId }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && orderId) {
            fetchOrderDetails();
        } else if (!isOpen) {
            // Reset order data when modal closes to avoid showing old data next time
            setOrder(null);
        }
    }, [isOpen, orderId]);

    const fetchOrderDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/orders/${orderId}/`);
            setOrder(res.data);
        } catch (err) {
            console.error('Error fetching order details:', err);
            setError('فشل في تحميل تفاصيل الطلب.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تفاصيل الطلب: #${order?.daily_id || ''}`}>
            <div className="space-y-6 max-h-[75vh] overflow-y-auto px-1 text-right" dir="rtl">
                {loading ? (
                    <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-400">
                        <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                        <p className="font-bold animate-pulse text-sm">جاري تحميل البيانات...</p>
                    </div>
                ) : error ? (
                    <div className="py-20 text-center text-red-500 font-bold">{error}</div>
                ) : order ? (
                    <>
                        {/* Status Header */}
                        <div className="flex items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-500 text-white rounded-lg">
                                    < Receipt size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest">رقم الطلب</p>
                                    <p className="text-xl font-black text-slate-900">{order.order_number}</p>
                                </div>
                            </div>
                            <div className="text-left">
                                <span className="px-3 py-1 bg-white border border-orange-200 text-orange-600 rounded-full text-[10px] font-black">
                                    {order.status_display}
                                </span>
                            </div>
                        </div>

                        {/* Order Meta Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1 justify-start">
                                    <Calendar size={12} className="text-slate-400" /> التاريخ
                                </p>
                                <p className="text-xs font-black text-slate-800">
                                    {new Date(order.created_at).toLocaleDateString('ar-EG')}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1 justify-start">
                                    <Clock size={12} className="text-slate-400" /> الوقت
                                </p>
                                <p className="text-xs font-black text-slate-800">
                                    {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                            <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 justify-start border-b border-slate-50 pb-2">
                                <User size={16} className="text-orange-500" /> معلومات العميل والطلب
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">الاسم:</span>
                                    <span className="font-black text-slate-800">{order.customer_name || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">الهاتف:</span>
                                    <span className="font-black text-slate-800">{order.customer_phone || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-bold">نوع الخدمة:</span>
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-black">{order.order_type_display}</span>
                                </div>
                                {order.table_number && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-400 font-bold">رقم الطاولة:</span>
                                        <span className="font-black text-slate-800">{order.table_number}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Items Table */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 justify-start">
                                <ShoppingBag size={16} className="text-orange-500" /> تفاصيل الأصناف المحاسبية
                            </h4>
                            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-right">
                                    <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase font-black border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-3">الصنف</th>
                                            <th className="px-4 py-3 text-center">الكمية</th>
                                            <th className="px-4 py-3 text-left">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {order.items?.map((item, idx) => (
                                            <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-slate-800">{item.menu_item_details?.name}</p>
                                                    <p className="text-[10px] text-slate-400">{item.unit_price} ج.م للواحد</p>
                                                    {item.notes && <p className="text-[10px] text-red-500 mt-1">ملاحظة: {item.notes}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-center font-black text-slate-600">x{item.quantity}</td>
                                                <td className="px-4 py-3 text-left font-black text-slate-900">
                                                    {(Number(item.unit_price) * item.quantity).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totals Section */}
                        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
                            <div className="space-y-3 relative z-10">
                                <div className="flex items-center justify-between text-xs opacity-70">
                                    <span className="font-bold">المجموع الفرعي:</span>
                                    <span className="font-black">{Number(order.subtotal).toFixed(2)} ج.م</span>
                                </div>
                                {Number(order.delivery_fee) > 0 && (
                                    <div className="flex items-center justify-between text-xs opacity-70">
                                        <span className="font-bold">رسوم التوصيل (+) :</span>
                                        <span className="font-black">{Number(order.delivery_fee).toFixed(2)} ج.م</span>
                                    </div>
                                )}
                                {Number(order.discount_amount) > 0 && (
                                    <div className="flex items-center justify-between text-xs text-red-400 font-bold">
                                        <span>خصم (-) :</span>
                                        <span className="font-black">{Number(order.discount_amount).toFixed(2)} ج.م</span>
                                    </div>
                                )}
                                <div className="border-t border-white/10 pt-4 mt-2 flex items-center justify-between">
                                    <span className="text-sm font-black text-orange-500 uppercase tracking-wider">الإجمالي المستحق:</span>
                                    <span className="text-2xl font-black text-white">{Number(order.total).toFixed(2)} <span className="text-xs font-normal opacity-60">ج.م</span></span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            <div className="pt-6">
                <button
                    onClick={onClose}
                    className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all border border-slate-100"
                >
                    إغلاق التفاصيل
                </button>
            </div>
        </Modal>
    );
}
