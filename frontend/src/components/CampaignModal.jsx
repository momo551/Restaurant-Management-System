import React, { useState, useEffect } from 'react';
import { X, Zap, Gift, Calendar, Tag } from 'lucide-react';

export default function CampaignModal({ isOpen, onClose, onConfirm, currentCampaign }) {
    const [formData, setFormData] = useState({
        name: '',
        multiplier: 2.0,
        start_date: '',
        end_date: ''
    });

    useEffect(() => {
        if (currentCampaign) {
            setFormData({
                name: currentCampaign.name || '',
                multiplier: currentCampaign.multiplier || 2.0,
                start_date: currentCampaign.start_date ? currentCampaign.start_date.slice(0, 16) : '',
                end_date: currentCampaign.end_date ? currentCampaign.end_date.slice(0, 16) : ''
            });
        } else {
            const now = new Date();
            const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            setFormData({
                name: '',
                multiplier: 2.0,
                start_date: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
                end_date: new Date(nextMonth.getTime() - nextMonth.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            });
        }
    }, [currentCampaign, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 text-right" dir="rtl">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Zap className="text-white" size={24} />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                        {currentCampaign ? 'تعديل حملة النقاط 🚀' : 'إنشاء حملة نقاط جديدة 🚀'}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">قم بتحديد تفاصيل الحملة ومضاعف النقاط الذي سيحصل عليه العميل.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">اسم الحملة</label>
                                <div className="relative">
                                    <Tag className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        placeholder="مثال: عرض نهاية الأسبوع، مهرجان الصيف"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-bold text-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">تاريخ البدء</label>
                                    <div className="relative">
                                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.start_date}
                                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                            className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-bold text-slate-700 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">تاريخ الانتهاء</label>
                                    <div className="relative">
                                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="datetime-local"
                                            required
                                            value={formData.end_date}
                                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            className="w-full pr-12 pl-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-bold text-slate-700 dark:text-white text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">مضاعف النقاط (x)</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {[1.5, 2.0, 3.0, 5.0].map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, multiplier: val })}
                                            className={`py-3 rounded-2xl font-black text-sm transition-all border-2 ${
                                                formData.multiplier === val 
                                                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' 
                                                : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:border-slate-200'
                                            }`}
                                        >
                                            x{val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex items-start gap-3">
                            <Gift className="text-orange-600 shrink-0 mt-0.5" size={18} />
                            <p className="text-[11px] text-orange-800 dark:text-orange-300 leading-relaxed font-medium">
                                سيحصل العميل على {formData.multiplier} نقطة مقابل كل 1 جنيه ينفقه خلال فترة الحملة.
                            </p>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-[1.5rem] font-bold text-sm hover:bg-slate-200 transition-all"
                            >
                                إلغاء
                            </button>
                            <button
                                type="submit"
                                className="flex-2 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-[1.5rem] font-bold text-sm hover:bg-orange-500 hover:text-white transition-all px-8 shadow-xl shadow-slate-900/10"
                            >
                                {currentCampaign ? 'حفظ التعديلات' : 'إنشاء وتفعيل الحملة'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
