import React, { useState, useEffect } from 'react';
import stockApi from '../api/stock';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, FileText, AlertTriangle, Search, Package, Layers, Activity } from 'lucide-react';

export default function IngredientsPage() {
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(10);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIng, setEditingIng] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        unit: '',
        reorder_level: 0,
        last_purchase_price: 0,
        is_active: true
    });

    const fetchIngredients = async () => {
        try {
            setLoading(true);
            const { data } = await stockApi.getIngredients({
                search: searchTerm,
                page: page,
                page_size: pageSize
            });
            setIngredients(data.results);
            setTotalCount(data.count);
        } catch (error) {
            console.error('Error fetching ingredients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchIngredients();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, page]);


    const handleOpenModal = (ing = null) => {
        if (ing) {
            setEditingIng(ing);
            setFormData({
                name: ing.name,
                unit: ing.unit,
                reorder_level: ing.reorder_level,
                last_purchase_price: ing.last_purchase_price || 0,
                is_active: ing.is_active
            });
        } else {
            setEditingIng(null);
            setFormData({ name: '', unit: '', reorder_level: 5, last_purchase_price: 0, is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingIng) {
                await stockApi.updateIngredient(editingIng.id, formData);
            } else {
                await stockApi.createIngredient(formData);
            }
            fetchIngredients();
            setIsModalOpen(false);
        } catch (error) {
            alert('خطأ في حفظ البيانات');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المكون؟')) {
            try {
                await stockApi.deleteIngredient(id);
                fetchIngredients();
            } catch (error) {
                alert('حدث خطأ أثناء الحذف');
            }
        }
    };

    const handleExportPdf = async () => {
        try {
            const response = await stockApi.exportPdf();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'inventory_report.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('خطأ في تصدير ملف PDF');
        }
    };

    const lowStockCount = ingredients.filter(ing => parseFloat(ing.quantity) <= parseFloat(ing.reorder_level)).length;

    const stats = [
        { label: 'إجمالي المكونات', value: totalCount, icon: <Layers className="text-blue-600" />, color: 'bg-blue-50' },
        { label: 'أصناف تحت حد الطلب', value: lowStockCount, icon: <AlertTriangle className="text-red-600" />, color: 'bg-red-50' },
        { label: 'الأصناف النشطة', value: ingredients.filter(i => i.is_active).length, icon: <Activity className="text-green-600" />, color: 'bg-green-50' }
    ];

    const columns = [
        {
            header: 'المكون', accessor: 'name', render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Package size={16} />
                    </div>
                    <span className="font-bold text-slate-800">{row.name}</span>
                </div>
            )
        },
        {
            header: 'الكمية الحالية', accessor: 'quantity', render: (row) => (
                <span className={`font-black font-sans text-sm ${parseFloat(row.quantity) <= parseFloat(row.reorder_level) ? 'text-red-600' : 'text-slate-700'}`}>
                    {parseFloat(row.quantity).toFixed(2)} {row.unit}
                </span>
            )
        },
        { header: 'حد الطلب', accessor: 'reorder_level', render: (row) => <span className="font-sans text-slate-500">{row.reorder_level}</span> },
        {
            header: 'آخر سعر شراء', accessor: 'last_purchase_price', render: (row) => (
                <span className="font-sans font-bold text-slate-700">{row.last_purchase_price ? `${row.last_purchase_price} ج.م` : '0 ج.م'}</span>
            )
        },
        {
            header: 'الحالة', accessor: 'is_active', render: (row) => (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {row.is_active ? 'نشط' : 'متوقف'}
                </div>
            )
        },
        {
            header: 'إجراءات', render: (row) => (
                <div className="flex gap-1 justify-end">
                    <button onClick={() => handleOpenModal(row)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                        <Trash2 size={18} />
                    </button>
                </div>
            )
        }
    ];

    const rowClassName = (row) => {
        if (parseFloat(row.quantity) <= parseFloat(row.reorder_level)) {
            return 'bg-red-50/50 border-r-4 border-r-red-500 font-bold';
        }
        return '';
    };

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 gap-6">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-100">
                        <Package size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">المكونات والمخزون</h1>
                        <p className="text-slate-500 font-medium">متابعة الأصناف الخام ومستويات المخزون</p>
                    </div>
                </div>

                <div className="flex-1 w-full max-w-lg relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="بحث سريع عن مكون..."
                        className="w-full pr-12 pl-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-orange-500/10 outline-none text-right font-bold text-slate-700 transition-all shadow-inner"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>

                <div className="flex gap-4 w-full lg:w-auto">
                    <button onClick={handleExportPdf} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-4 border-2 border-slate-100 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-black">
                        <FileText size={20} />
                        PDF
                    </button>
                    <button onClick={() => handleOpenModal()} className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-8 py-4 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-all font-black shadow-xl shadow-orange-100 active:scale-95">
                        <Plus size={24} />
                        إضافة صنف جديد
                    </button>
                </div>
            </div>

            {/* Dash Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                        <div className={`p-4 ${stat.color} rounded-2xl`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800 font-sans mt-0.5">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-32">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600"></div>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={ingredients}
                        rowClassName={rowClassName}
                        pagination={{
                            currentPage: page,
                            totalCount: totalCount,
                            pageSize: pageSize,
                            onPageChange: (p) => setPage(p)
                        }}
                    />
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingIng ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
            >
                <form onSubmit={handleSave} className="space-y-6 text-right pb-2">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">اسم المكون الخام</label>
                            <input
                                type="text"
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">الوحدة (كجم، لتر...)</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                    value={formData.unit}
                                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">حد الطلب (Alert)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    required
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-sans font-bold text-slate-700"
                                    value={formData.reorder_level}
                                    onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">آخر سعر شراء (ج.م)</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-sans font-bold text-slate-700"
                                value={formData.last_purchase_price}
                                onChange={(e) => setFormData({ ...formData, last_purchase_price: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <input
                            type="checkbox"
                            id="is_active"
                            className="w-5 h-5 accent-orange-600 rounded-lg cursor-pointer"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <label htmlFor="is_active" className="text-sm font-bold text-slate-700 cursor-pointer">تفعيل هذا المكون في النظام</label>
                    </div>
                    <div className="pt-6 border-t border-slate-100 flex gap-4">
                        <button type="submit" className="flex-1 bg-orange-600 text-white py-4 rounded-2xl hover:bg-orange-700 transition-all font-black shadow-lg shadow-orange-100 active:scale-95">
                            حفظ الصنف
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
