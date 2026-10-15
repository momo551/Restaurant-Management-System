import React, { useState, useEffect } from 'react';
import stockApi from '../api/stock';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Phone, Package, Truck, Users, Star, MapPin } from 'lucide-react';

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        notes: '',
        ingredients: []
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [suppliersRes, ingsRes] = await Promise.all([
                stockApi.getSuppliers(),
                stockApi.getIngredients({ page_size: 100 })
            ]);
            setSuppliers(suppliersRes.data);
            setIngredients(ingsRes.data.results || ingsRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                phone: supplier.phone,
                address: supplier.address,
                notes: supplier.notes,
                ingredients: supplier.ingredients || []
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: '', phone: '', address: '', notes: '', ingredients: [] });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                await stockApi.updateSupplier(editingSupplier.id, formData);
            } else {
                await stockApi.createSupplier(formData);
            }
            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            alert('خطأ في حفظ البيانات');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المورد؟')) {
            try {
                await stockApi.deleteSupplier(id);
                fetchData();
            } catch (error) {
                alert('حدث خطأ أثناء الحذف');
            }
        }
    };

    const handleIngredientToggle = (id) => {
        const current = [...formData.ingredients];
        if (current.includes(id)) {
            setFormData({ ...formData, ingredients: current.filter(i => i !== id) });
        } else {
            setFormData({ ...formData, ingredients: [...current, id] });
        }
    };

    const stats = [
        { label: 'إجمالي الموردين', value: suppliers.length, icon: <Users className="text-blue-600" />, color: 'bg-blue-50' },
        {
            label: 'متوسط المكونات/مورد',
            value: suppliers.length > 0
                ? (suppliers.reduce((acc, curr) => acc + (curr.ingredients?.length || 0), 0) / suppliers.length).toFixed(1)
                : '0',
            icon: <Package className="text-orange-600" />,
            color: 'bg-orange-50'
        },
        {
            label: 'أكثر مورد نشط',
            value: suppliers.length > 0
                ? suppliers.reduce((prev, current) => (prev.ingredients?.length > current.ingredients?.length) ? prev : current).name
                : '-',
            icon: <Star className="text-yellow-600" />,
            color: 'bg-yellow-50'
        }
    ];

    const columns = [
        {
            header: 'اسم المورد', accessor: 'name', render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black shadow-inner border border-white">
                        {row.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-black text-slate-800">{row.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                            <MapPin size={10} /> {row.address || 'بلا عنوان'}
                        </p>
                    </div>
                </div>
            )
        },
        {
            header: 'بيانات الاتصال', accessor: 'phone', render: (row) => (
                <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-slate-700 font-sans font-black text-sm">
                        <span>{row.phone}</span>
                        <Phone size={14} className="text-orange-500" />
                    </div>
                </div>
            )
        },
        {
            header: 'المكونات الموردة', render: (row) => (
                <div className="flex flex-wrap gap-1.5 justify-end max-w-[350px]">
                    {row.ingredient_names?.length > 0 ? (
                        row.ingredient_names.map((name, idx) => (
                            <span key={idx} className="px-3 py-1 bg-white border border-slate-100 text-slate-600 rounded-xl text-[10px] font-black shadow-sm group hover:border-orange-200 transition-colors">
                                {name}
                            </span>
                        ))
                    ) : (
                        <span className="text-slate-300 text-xs italic font-medium">لا توجد مكونات مرتبطة</span>
                    )}
                </div>
            )
        },
        {
            header: 'إجراءات', render: (row) => (
                <div className="flex gap-1 justify-end">
                    <button onClick={() => handleOpenModal(row)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all active:scale-90">
                        <Edit2 size={20} />
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90">
                        <Trash2 size={20} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* Page Header */}
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-100">
                        <Truck size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">إدارة الموردين</h1>
                        <p className="text-slate-500 font-medium">بيانات الموردين والمكونات التي يوفرونها</p>
                    </div>
                </div>
                <button onClick={() => handleOpenModal()} className="flex items-center gap-3 px-8 py-4 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-all font-black shadow-xl shadow-orange-100 active:scale-95">
                    <Plus size={24} />
                    إضافة مورد جديد
                </button>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
                        <div className={`p-4 ${stat.color} rounded-2xl`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800 font-sans mt-0.5 truncate max-w-[150px]">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Stage */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-32">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600"></div>
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        data={suppliers}
                    />
                )}
            </div>

            {/* Supplier Form Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}
            >
                <form onSubmit={handleSave} className="space-y-6 text-right pb-2">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">اسم المورد / الشركة</label>
                            <input
                                type="text"
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-black text-slate-700 mb-2">رقم الهاتف</label>
                            <input
                                type="text"
                                required
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-sans font-bold text-slate-700"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="01xxxxxxxxx"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-2">العنوان الكامل</label>
                        <input
                            type="text"
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="المحافظة، المنطقة، الشارع..."
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
                                <Package size={16} className="text-orange-500" />
                                المكونات التي يوفرها المورد
                            </label>
                            <span className="text-[10px] font-black text-orange-500 uppercase bg-orange-50 px-2 py-0.5 rounded-lg">اختر المكونات</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner scrollbar-thin scrollbar-thumb-slate-200">
                            {ingredients.map((ing) => (
                                <div
                                    key={ing.id}
                                    onClick={() => handleIngredientToggle(ing.id)}
                                    className={`
                                        cursor-pointer px-4 py-3 rounded-2xl text-[11px] font-black transition-all flex items-center gap-3 border-2
                                        ${formData.ingredients.includes(ing.id)
                                            ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-100 translate-y-[-2px]'
                                            : 'bg-white text-slate-600 border-transparent hover:border-orange-100 hover:text-orange-600'}
                                    `}
                                >
                                    <div className={`p-1 rounded-md ${formData.ingredients.includes(ing.id) ? 'bg-orange-500' : 'bg-slate-100'} transition-colors`}>
                                        <Package size={14} />
                                    </div>
                                    <span className="truncate">{ing.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-700 mb-2">ملاحظات إضافية</label>
                        <textarea
                            rows="2"
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="أي تفاصيل أخرى..."
                        ></textarea>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button type="submit" className="flex-1 bg-orange-600 text-white py-4 rounded-2xl hover:bg-orange-700 transition-all font-black shadow-lg shadow-orange-100 active:scale-95">
                            حفظ المورد
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
