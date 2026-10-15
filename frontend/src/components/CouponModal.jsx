import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Ticket, Percent, Calendar, User, ShoppingBag } from 'lucide-react';

export default function CouponModal({ isOpen, onClose, onSave, customers = [], couponToEdit = null }) {
    const [formData, setFormData] = useState({
        code: '',
        discount_amount: '',
        min_purchase: '0',
        valid_until: '',
        customer: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (couponToEdit) {
            setFormData({
                code: couponToEdit.code || '',
                discount_amount: couponToEdit.discount_amount || '',
                min_purchase: couponToEdit.min_purchase || '0',
                valid_until: couponToEdit.valid_until ? couponToEdit.valid_until.slice(0, 16) : '',
                customer: couponToEdit.customer || ''
            });
        } else {
            setFormData({
                code: '',
                discount_amount: '',
                min_purchase: '0',
                valid_until: '',
                customer: ''
            });
        }
    }, [couponToEdit, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await onSave(formData, couponToEdit?.id);
            onClose();
        } catch (err) {
            console.error('Error saving coupon:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={couponToEdit ? 'تعديل الكوبون' : 'إنشاء كوبون جديد'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Coupon Code */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Ticket size={12} /> كود الكوبون
                        </label>
                        <input
                            required
                            type="text"
                            name="code"
                            value={formData.code}
                            onChange={handleChange}
                            placeholder="مثلاً: SAVE20"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                        />
                    </div>

                    {/* Discount Amount */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Percent size={12} /> قيمة الخصم (ج.م)
                        </label>
                        <input
                            required
                            type="number"
                            name="discount_amount"
                            value={formData.discount_amount}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                        />
                    </div>

                    {/* Min Purchase */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <ShoppingBag size={12} /> الحد الأدنى للشراء
                        </label>
                        <input
                            type="number"
                            name="min_purchase"
                            value={formData.min_purchase}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                        />
                    </div>

                    {/* Valid Until */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Calendar size={12} /> صالح حتى
                        </label>
                        <input
                            required
                            type="datetime-local"
                            name="valid_until"
                            value={formData.valid_until}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                        />
                    </div>
                </div>

                {/* Target Customer (Optional) */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <User size={12} /> تخصيص لعميل (اختياري)
                    </label>
                    <select
                        name="customer"
                        value={formData.customer}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold"
                    >
                        <option value="">جميع العملاء</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all text-center"
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                    >
                        {submitting ? 'جاري الحفظ...' : 'حفظ الكوبون'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
