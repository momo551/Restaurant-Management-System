import React, { useState } from 'react';
import Modal from './Modal';
import { Clock, Star, TrendingUp, TrendingDown, AlertCircle, ExternalLink } from 'lucide-react';
import OrderDetailsModal from './OrderDetailsModal';

export default function CustomerPointsModal({ isOpen, onClose, customer }) {
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);

    if (!customer) return null;

    const points = customer.loyalty_points || [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`سجل نقاط: ${customer.name}`}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 text-right" dir="rtl">
                {/* Current Balance Card */}
                <div className="flex items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <div>
                        <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">الرصيد الحالي</p>
                        <p className="text-2xl font-black text-orange-900">{customer.points_balance || 0} نقطة</p>
                    </div>
                    <Star className="text-orange-500 fill-orange-500 w-10 h-10 opacity-20" />
                </div>

                <div className="space-y-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm justify-start">
                        <Clock size={16} className="text-slate-400" /> العمليات الأخيرة
                    </h4>

                    {points.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            لا يوجد سجل عمليات لهذا العميل حتى الآن.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {points.map((point) => (
                                <div 
                                    key={point.id} 
                                    className={`bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between transition-all ${
                                        point.order ? 'cursor-pointer hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/5 group/point' : 'hover:border-slate-200'
                                    }`}
                                    onClick={() => {
                                        if (point.order) {
                                            setSelectedOrderId(point.order);
                                            setShowOrderModal(true);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-xl transition-all ${
                                            point.transaction_type === 'earned' 
                                            ? 'bg-green-50 text-green-600 group-hover/point:bg-green-600 group-hover/point:text-white' 
                                            : point.transaction_type === 'redeemed'
                                            ? 'bg-red-50 text-red-600 group-hover/point:bg-red-600 group-hover/point:text-white'
                                            : 'bg-slate-50 text-slate-600 group-hover/point:bg-slate-600 group-hover/point:text-white'
                                        }`}>
                                            {point.transaction_type === 'earned' ? (
                                                <TrendingUp size={20} />
                                            ) : point.transaction_type === 'redeemed' ? (
                                                <TrendingDown size={20} />
                                            ) : (
                                                <AlertCircle size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800 text-sm group-hover/point:text-orange-600 transition-colors">
                                                    {point.description || (
                                                        point.transaction_type === 'earned' ? 'إضافة نقاط' : 
                                                        point.transaction_type === 'redeemed' ? 'استبدال نقاط' : 'انتهاء صلاحية'
                                                    )}
                                                </p>
                                                {point.order && (
                                                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold group-hover/point:bg-orange-100 group-hover/point:text-orange-600">
                                                        <ExternalLink size={8} /> شاهد الطلب
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {new Date(point.created_at).toLocaleString('ar-EG', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`text-sm font-black ${
                                        point.transaction_type === 'earned' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {point.transaction_type === 'earned' ? '+' : '-'}{Math.abs(point.points)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="pt-6">
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                >
                    إغلاق
                </button>
            </div>

            <OrderDetailsModal 
                isOpen={showOrderModal}
                onClose={() => setShowOrderModal(false)}
                orderId={selectedOrderId}
            />
        </Modal>
    );
}
