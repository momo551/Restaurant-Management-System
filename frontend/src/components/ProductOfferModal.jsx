import React, { useState, useEffect } from 'react';
import { Tag, Calendar, Percent, X, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import Modal from './Modal';

export default function ProductOfferModal({ isOpen, onClose, onSave, offerToEdit = null, menuItems = [] }) {
    const [formData, setFormData] = useState({
        name: '',
        product: '',
        products: [],
        discount_percentage: '',
        points_multiplier: '1.0',
        start_date: '',
        end_date: '',
        is_active: true
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (offerToEdit) {
            setFormData({
                ...offerToEdit,
                products: [], // not used when editing
                start_date: offerToEdit.start_date.slice(0, 16), // format for datetime-local
                end_date: offerToEdit.end_date.slice(0, 16)
            });
        } else {
            // default to now and 7 days from now
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            setFormData({
                product: '',
                products: [],
                discount_percentage: '',
                points_multiplier: '1.0',
                start_date: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
                end_date: new Date(nextWeek.getTime() - nextWeek.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
                is_active: true
            });
        }
        setError('');
    }, [offerToEdit, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (offerToEdit) {
            if (!formData.product) {
                setError('يرجى اختيار صنف العرض');
                return;
            }
        } else {
            if (!formData.products || formData.products.length === 0) {
                setError('يرجى اختيار صنف واحد على الأقل للعرض');
                return;
            }
        }

        if (new Date(formData.end_date) <= new Date(formData.start_date)) {
            setError('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
            return;
        }

        setSubmitting(true);
        try {
            if (offerToEdit) {
                const payload = { ...formData };
                delete payload.products;
                await api.patch(`/menu/offers/${offerToEdit.id}/`, payload);
            } else {
                const payload = { ...formData };
                delete payload.product;
                await api.post('/menu/offers/', payload);
            }
            onSave();
            onClose();
        } catch (err) {
            const data = err.response?.data;
            if (data && typeof data === 'object') {
                if (data.details && Array.isArray(data.details)) {
                    const firstFail = data.details[0];
                    if (firstFail && firstFail.errors) {
                        const errKey = Object.keys(firstFail.errors)[0];
                        if (errKey && Array.isArray(firstFail.errors[errKey])) {
                            const itemName = menuItems.find(i => i.id === firstFail.product_id)?.name || `صنف #${firstFail.product_id}`;
                            setError(`خطأ في (${itemName}): ${firstFail.errors[errKey][0]}`);
                            setSubmitting(false);
                            return;
                        }
                    }
                }
                const firstErrorKey = Object.keys(data)[0];
                if (firstErrorKey && Array.isArray(data[firstErrorKey])) {
                    setError(data[firstErrorKey][0]);
                } else if (typeof data[firstErrorKey] === 'string') {
                    setError(data[firstErrorKey]);
                } else if (data.message) {
                    setError(data.message);
                } else {
                    setError('فشل في حفظ العرض. تأكد من صحة البيانات.');
                }
            } else {
                setError('فشل في حفظ العرض. يرجى المحاولة لاحقاً.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={offerToEdit ? 'تعديل عرض صنف' : 'إضافة عرض صنف جديد'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2 text-sm">
                        <AlertCircle size={16} className="shrink-0" /> <span className="flex-1">{error}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">اسم العرض (اختياري)</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="مثال: خصم الصيف، عرض التوفير"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            {offerToEdit ? 'الصنف المستهدف (المنتج)' : 'الأصناف المستهدفة (اختر صنف أو أكثر لإضافته للعرض)'}
                        </label>
                        
                        {offerToEdit ? (
                            <select
                                required
                                value={formData.product}
                                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                            >
                                <option value="">-- اختر صنف --</option>
                                {menuItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
                                {menuItems.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-sm">لا توجد أصناف متاحة</div>
                                ) : (
                                    menuItems.map(item => (
                                        <label key={item.id} className="flex items-center gap-3 p-3 hover:bg-slate-100 rounded-lg cursor-pointer transition-all border border-transparent hover:border-slate-200">
                                            <input 
                                                type="checkbox"
                                                checked={formData.products.includes(item.id)}
                                                onChange={(e) => {
                                                    const updated = e.target.checked 
                                                        ? [...formData.products, item.id] 
                                                        : formData.products.filter(id => id !== item.id);
                                                    setFormData({ ...formData, products: updated });
                                                }}
                                                className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                            />
                                            <span className="text-sm font-bold text-slate-700 flex-1">{item.name}</span>
                                            <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-md">{item.price} ج.م</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Percent size={14} className="text-slate-400" /> نسبة الخصم (%)
                            </label>
                            <input
                                type="number"
                                required
                                min="0" max="100" step="1"
                                value={formData.discount_percentage}
                                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                                placeholder="مثال: 20"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">مضاعف النقاط</label>
                            <select
                                value={formData.points_multiplier}
                                onChange={(e) => setFormData({ ...formData, points_multiplier: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                            >
                                <option value="1.0">نقاط عادية (1x)</option>
                                <option value="1.5">نقطة ونصف (1.5x)</option>
                                <option value="2.0">ضعف النقاط (2x)</option>
                                <option value="3.0">ثلاثة أضعاف (3x)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" /> تاريخ وزمن البدء
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Calendar size={14} className="text-slate-400" /> تاريخ وزمن الانتهاء
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.end_date}
                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-orange-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[100%] rtl:peer-checked:after:-translate-x-[100%] peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                        <span className="text-sm font-bold text-slate-700">تفعيل العرض فوراً</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2.5 text-white font-bold bg-orange-500 hover:bg-orange-600 rounded-xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting ? 'جاري الحفظ...' : (offerToEdit ? 'تحديث العرض' : 'إنشاء العروض')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
