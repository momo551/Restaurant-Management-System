import React, { useState, useEffect } from 'react';
import stockApi from '../api/stock';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { History, ArrowUpRight, ArrowDownLeft, RefreshCcw, Plus, Filter, X, Calendar, Activity, Database } from 'lucide-react';

export default function StockMovementsPage() {
    const [movements, setMovements] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Pagination states
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(10);

    // Filter states
    const [filters, setFilters] = useState({
        ingredient: '',
        created_at__gte: '',
        created_at__lte: ''
    });

    const [formData, setFormData] = useState({
        ingredient: '',
        quantity: '',
        type: 'IN', // IN, OUT, ADJUSTMENT
        notes: ''
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const activeFilters = {
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v !== '')
                ),
                page: page,
                page_size: pageSize
            };

            const [movementsRes, ingsRes] = await Promise.all([
                stockApi.getMovements(activeFilters),
                stockApi.getIngredients({ page_size: 100 })
            ]);
            setMovements(movementsRes.data.results);
            setTotalCount(movementsRes.data.count);
            setIngredients(ingsRes.data.results || ingsRes.data);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters, page]);

    const handleSaveAdjustment = async (e) => {
        e.preventDefault();
        try {
            await stockApi.adjustStock(formData.ingredient, {
                quantity: formData.quantity,
                type: formData.type,
                notes: formData.notes
            });
            fetchData();
            setIsModalOpen(false);
            setFormData({ ingredient: '', quantity: '', type: 'IN', notes: '' });
        } catch (error) {
            alert(error.response?.data?.error || 'خطأ في معالجة الحركة');
        }
    };

    const clearFilters = () => {
        setFilters({
            ingredient: '',
            created_at__gte: '',
            created_at__lte: ''
        });
        setPage(1);
    };

    const stats = [
        {
            label: 'إجمالي الحركات',
            value: totalCount,
            icon: <Activity className="text-blue-600" />,
            color: 'bg-blue-50'
        },
        {
            label: 'عمليات التوريد (IN)',
            value: movements.filter(m => m.type === 'IN').length,
            icon: <ArrowUpRight className="text-green-600" />,
            color: 'bg-green-50'
        },
        {
            label: 'عمليات الاستهلاك (OUT)',
            value: movements.filter(m => m.type === 'OUT').length,
            icon: <ArrowDownLeft className="text-red-600" />,
            color: 'bg-red-50'
        }
    ];

    const columns = [
        {
            header: 'المكون', accessor: 'ingredient_name', render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Database size={16} />
                    </div>
                    <span className="font-bold text-slate-800">{row.ingredient_name}</span>
                </div>
            )
        },
        {
            header: 'الكمية', accessor: 'quantity', render: (row) => (
                <span className="font-sans font-black text-slate-700">{row.quantity}</span>
            )
        },
        {
            header: 'نوع الحركة', accessor: 'type', render: (row) => {
                const typeMap = {
                    'IN': { label: 'وارد / شراء', color: 'bg-green-100 text-green-700', icon: <ArrowUpRight size={14} /> },
                    'OUT': { label: 'صادر / استهلاك', color: 'bg-red-100 text-red-700', icon: <ArrowDownLeft size={14} /> },
                    'ADJUSTMENT': { label: 'تعديل جرد', color: 'bg-blue-100 text-blue-700', icon: <RefreshCcw size={14} /> }
                };
                const type = typeMap[row.type] || { label: row.type, color: 'bg-slate-100' };
                return (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black ${type.color}`}>
                        {type.icon}
                        {type.label}
                    </div>
                );
            }
        },
        {
            header: 'بواسطة', accessor: 'user_name', render: (row) => (
                <span className="text-xs font-bold text-slate-500">{row.user_name}</span>
            )
        },
        {
            header: 'ملاحظات', accessor: 'notes', render: (row) => (
                <p className="max-w-[200px] truncate text-slate-500 text-xs">{row.notes || '-'}</p>
            )
        },
        {
            header: 'التاريخ', accessor: 'created_at', render: (row) => (
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {new Date(row.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-slate-700 font-sans font-bold">
                        {new Date(row.created_at).toLocaleDateString('ar-EG')}
                    </span>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* Header Area */}
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                        <History size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">حركات المخزن</h1>
                        <p className="text-slate-500 font-medium">سجل شامل لجميع عمليات الوارد والصادر والجرد</p>
                    </div>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all font-bold shadow-xl shadow-slate-100 active:scale-95">
                    <Plus size={24} />
                    تسجيل حركة يدوية
                </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
                        <div className={`p-4 ${stat.color} rounded-2xl`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-400">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800 font-sans mt-0.5">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium Filters Bar */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap gap-6 items-end">
                <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 px-1">
                        <Database size={14} />
                        <label className="text-xs font-black uppercase tracking-wider">تصفية حسب المكون</label>
                    </div>
                    <select
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                        value={filters.ingredient}
                        onChange={(e) => {
                            setFilters({ ...filters, ingredient: e.target.value });
                            setPage(1);
                        }}
                    >
                        <option value="">كل المكونات</option>
                        {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                    </select>
                </div>

                <div className="w-56">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 px-1">
                        <Calendar size={14} />
                        <label className="text-xs font-black uppercase tracking-wider">من تاريخ</label>
                    </div>
                    <input
                        type="date"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans font-bold text-slate-700"
                        value={filters.created_at__gte}
                        onChange={(e) => {
                            setFilters({ ...filters, created_at__gte: e.target.value });
                            setPage(1);
                        }}
                    />
                </div>

                <div className="w-56">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 px-1">
                        <Calendar size={14} />
                        <label className="text-xs font-black uppercase tracking-wider">إلى تاريخ</label>
                    </div>
                    <input
                        type="date"
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans font-bold text-slate-700"
                        value={filters.created_at__lte}
                        onChange={(e) => {
                            setFilters({ ...filters, created_at__lte: e.target.value });
                            setPage(1);
                        }}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={clearFilters}
                        className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100 shadow-sm"
                        title="مسح الفلاتر"
                    >
                        <X size={24} />
                    </button>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-blue-500">
                        <Filter size={24} />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-32">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                            <History className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-200" size={20} />
                        </div>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={movements}
                        pagination={{
                            currentPage: page,
                            totalCount: totalCount,
                            pageSize: pageSize,
                            onPageChange: (p) => setPage(p)
                        }}
                    />
                )}
            </div>

            {/* Adjustment Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="تسجيل حركة مخزن جديدة"
            >
                <form onSubmit={handleSaveAdjustment} className="space-y-6 text-right pb-2">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">المكون المستهدف</label>
                            <select
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                value={formData.ingredient}
                                onChange={(e) => setFormData({ ...formData, ingredient: e.target.value })}
                            >
                                <option value="">اختار المكون...</option>
                                {ingredients.map(ing => (
                                    <option key={ing.id} value={ing.id}>{ing.name} (المتوفر الحالي: {ing.quantity})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">نوع الحركة</label>
                                <select
                                    required
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="IN">وارد (زيادة مخزون)</option>
                                    <option value="OUT">صادر (سحب/هالك)</option>
                                    <option value="ADJUSTMENT">تعديل جرد (قيمة دقيقة)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">الكمية</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    required
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-sans font-bold text-slate-700"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">السبب / الملاحظات</label>
                            <textarea
                                rows="3"
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="اكتب سبب الحركة هنا..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button type="submit" className="flex-1 bg-slate-900 text-white py-4 rounded-2xl hover:bg-black transition-all font-black shadow-lg shadow-slate-100 active:scale-95">
                            تأكيد وتسجيل
                        </button>
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl hover:bg-slate-200 transition-all font-black active:scale-95">
                            إلغاء
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
