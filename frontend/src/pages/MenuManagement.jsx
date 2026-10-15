import { useState, useEffect } from 'react';
import api from '../api/axios';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Filter,
    X,
    Upload,
    Loader2
} from 'lucide-react';

export default function MenuManagement() {
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCampaign, setActiveCampaign] = useState(null);

    // Category states
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [catFormData, setCatFormData] = useState({
        name: '',
        name_en: '',
        display_order: 0,
        is_active: true
    });

    // Item Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        name_en: '',
        category: '',
        price: '',
        description: '',
        preparation_time: 15,
        display_order: 0,
        is_available: true
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [catRes, itemRes, campaignRes] = await Promise.all([
                api.get('/menu/categories/'),
                api.get('/menu/items/'),
                api.get('/loyalty/campaigns/active/')
            ]);
            setCategories(catRes.data);
            setItems(itemRes.data);
            setActiveCampaign(campaignRes.data);
        } catch (err) {
            console.error('Error fetching menu data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                name_en: item.name_en || '',
                category: item.category,
                price: item.price,
                description: item.description || '',
                preparation_time: item.preparation_time,
                display_order: item.display_order,
                is_available: item.is_available
            });
            setImagePreview(item.image);
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                name_en: '',
                category: categories.length > 0 ? categories[0].id : '',
                price: '',
                description: '',
                preparation_time: 15,
                display_order: 0,
                is_available: true
            });
            setImagePreview(null);
        }
        setImageFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setImageFile(null);
        setImagePreview(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const data = new FormData();
        Object.keys(formData).forEach(key => {
            data.append(key, formData[key]);
        });
        if (imageFile) {
            data.append('image', imageFile);
        }

        if (!formData.category) {
            alert('يرجى اختيار الفئة أولاً.');
            setSubmitting(false);
            return;
        }

        try {
            if (editingItem) {
                await api.patch(`/menu/items/${editingItem.id}/`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/menu/items/', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving menu item', err);
            const errorData = err.response?.data;
            if (errorData) {
                // Formatting error messages from DRF
                const messages = Object.entries(errorData)
                    .map(([key, rawValue]) => {
                        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
                        return `${key}: ${value}`;
                    })
                    .join('\n');
                alert(`خطأ في البيانات:\n${messages}`);
            } else {
                alert('حدث خطأ غير متوقع أثناء حفظ الصنف.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
            try {
                await api.delete(`/menu/items/${id}/`);
                fetchData();
            } catch (err) {
                console.error('Error deleting menu item', err);
                const errorMsg = err.response?.data?.error || 'حدث خطأ أثناء حذف الصنف.';
                alert(errorMsg);
            }
        }
    };

    const handleCatSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingCat) {
                await api.patch(`/menu/categories/${editingCat.id}/`, catFormData);
            } else {
                await api.post('/menu/categories/', catFormData);
            }
            fetchData();
            setEditingCat(null);
            setCatFormData({ name: '', name_en: '', display_order: 0, is_active: true });
        } catch (err) {
            console.error('Error saving category', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCatDelete = async (id) => {
        if (window.confirm('بعد حذف الفئة ستفقد كل الأصناف المرتبطة بها. هل أنت متأكد؟')) {
            try {
                await api.delete(`/menu/categories/${id}/`);
                fetchData();
            } catch (err) {
                console.error('Error deleting category', err);
                const errorMsg = err.response?.data?.error || 'حدث خطأ أثناء حذف الفئة.';
                alert(errorMsg);
            }
        }
    };

    const toggleAvailability = async (id) => {
        try {
            await api.post(`/menu/items/${id}/toggle_availability/`);
            fetchData();
        } catch (err) {
            console.error('Error toggling availability', err);
        }
    };

    const toggleCategoryItems = async (categoryId, isAvailable) => {
        const action = isAvailable ? 'تفعيل' : 'تعطيل';
        if (window.confirm(`هل أنت متأكد من ${action} جميع الأصناف في هذه الفئة؟`)) {
            try {
                await api.post(`/menu/categories/${categoryId}/toggle_items/`, { is_available: isAvailable });
                fetchData();
            } catch (err) {
                console.error(`Error ${action} category items`, err);
                alert(`حدث خطأ أثناء ${action} الأصناف.`);
            }
        }
    };

    const filteredItems = items.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category === parseInt(selectedCategory);
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.name_en && item.name_en.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="animate-spin text-orange-500" size={40} />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">إدارة المنيو 🍔</h1>
                    <p className="text-slate-500">تحكم في الأصناف، الفئات، والأسعار.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsCatModalOpen(true)}
                        className="bg-white px-4 py-2 rounded-xl text-slate-600 border border-slate-200 flex items-center gap-2 hover:bg-slate-50 transition-all font-medium"
                    >
                        <Filter size={18} />
                        الفئات
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-orange-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all font-medium"
                    >
                        <Plus size={18} />
                        إضافة صنف جديد
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="البحث عن صنف..."
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                        الكل
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id.toString())}
                            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${selectedCategory === cat.id.toString() ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                    <div key={item.id} className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all group ${!item.is_available && 'opacity-75 grayscale'}`}>
                        <div className="h-40 bg-slate-100 relative overflow-hidden">
                            {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <Utensils size={40} />
                                </div>
                            )}
                            <div className="absolute top-2 left-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${item.is_available ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                    {item.is_available ? 'متاح' : 'غير متاح'}
                                </span>
                            </div>
                            {item.active_offer && (
                                <div className="absolute top-2 right-2 flex flex-col gap-1">
                                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg">
                                        خصم {Number(item.active_offer.discount_percentage).toFixed(0)}%
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-bold text-slate-800">{item.name}</h3>
                                <div className="text-right">
                                    {item.active_offer ? (
                                        <>
                                            <span className="text-orange-600 font-bold block">{item.active_offer.discounted_price} ج.م</span>
                                            <span className="text-[10px] text-slate-400 line-through">{item.price} ج.م</span>
                                        </>
                                    ) : (
                                        <span className="text-orange-600 font-bold">{item.price} ج.م</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs text-slate-400">{item.category_name}</p>
                                {(() => {
                                    const multiplier = item.active_offer?.points_multiplier || (activeCampaign?.is_active ? activeCampaign.multiplier : 1);
                                    const price = item.active_offer?.discounted_price || item.price;
                                    const points = Math.floor(price * multiplier);
                                    return (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                            <span>⭐ {points} نقطة</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-4">
                                <button
                                    onClick={() => toggleAvailability(item.id)}
                                    className={`flex-1 py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1 ${item.is_available ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-green-500 bg-green-50 hover:bg-green-100'}`}
                                >
                                    {item.is_available ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                    {item.is_available ? 'تعطيل' : 'تفعيل'}
                                </button>
                                <button
                                    onClick={() => handleOpenModal(item)}
                                    className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-all"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add New Placeholder */}
                <button
                    onClick={() => handleOpenModal()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 transition-all min-h-[300px]"
                >
                    <Plus size={32} />
                    <span className="font-medium">إضافة صنف جديد</span>
                </button>
            </div>

            {/* Categories Modal */}
            {isCatModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">إدارة الفئات</h2>
                            <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Add/Edit Category Form */}
                            <form onSubmit={handleCatSubmit} className="bg-slate-50 p-4 rounded-xl space-y-4">
                                <h3 className="font-bold text-slate-800">
                                    {editingCat ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-600">الاسم (بالعربي)</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={catFormData.name}
                                            onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-600">الاسم (English)</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={catFormData.name_en}
                                            onChange={(e) => setCatFormData({ ...catFormData, name_en: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-600">ترتيب العرض</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={catFormData.display_order}
                                            onChange={(e) => setCatFormData({ ...catFormData, display_order: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                                checked={catFormData.is_active}
                                                onChange={(e) => setCatFormData({ ...catFormData, is_active: e.target.checked })}
                                            />
                                            <span className="text-sm font-medium text-slate-700">نشط</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    {editingCat && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingCat(null);
                                                setCatFormData({ name: '', name_en: '', display_order: 0, is_active: true });
                                            }}
                                            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-all flex items-center gap-2"
                                    >
                                        {submitting && <Loader2 size={14} className="animate-spin" />}
                                        {editingCat ? 'تحديث' : 'إضافة'}
                                    </button>
                                </div>
                            </form>

                            {/* Categories List */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-slate-800">الفئات الحالية</h3>
                                <div className="divide-y divide-slate-100">
                                    {categories.map(cat => (
                                        <div key={cat.id} className="py-3 flex items-center justify-between group">
                                            <div>
                                                <div className="font-bold text-slate-800">{cat.name}</div>
                                                <div className="text-xs text-slate-400">{cat.name_en || 'لا يوجد اسم إنجليزي'} | ترتيب: {cat.display_order}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cat.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {cat.is_active ? 'نشط' : 'معطل'}
                                                </span>
                                                <div className="flex items-center gap-1 border-r border-slate-100 pr-2 mr-2">
                                                    <button
                                                        onClick={() => toggleCategoryItems(cat.id, true)}
                                                        className="text-[10px] px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded transition-all font-bold"
                                                        title="تفعيل كل الأصناف"
                                                    >
                                                        تفعيل الكل
                                                    </button>
                                                    <button
                                                        onClick={() => toggleCategoryItems(cat.id, false)}
                                                        className="text-[10px] px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-all font-bold"
                                                        title="تعطيل كل الأصناف"
                                                    >
                                                        تعطيل الكل
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingCat(cat);
                                                        setCatFormData({
                                                            name: cat.name,
                                                            name_en: cat.name_en || '',
                                                            display_order: cat.display_order,
                                                            is_active: cat.is_active
                                                        });
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleCatDelete(cat.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Add/Edit Item Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">الاسم (بالعربي)</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">الاسم (English)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.name_en}
                                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">الفئة</label>
                                    <select
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        <option value="">اختر الفئة</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">السعر (ج.م)</label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">وقت التحضير (دقيقة)</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.preparation_time}
                                        onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">ترتيب العرض</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">الوصف</label>
                                <textarea
                                    rows="3"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none resize-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">صورة الصنف</label>
                                <div
                                    onClick={() => document.getElementById('item-image').click()}
                                    className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-orange-500 hover:bg-orange-50 transition-all cursor-pointer relative overflow-hidden group min-h-[150px]"
                                >
                                    {imagePreview ? (
                                        <>
                                            <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Upload className="text-white" size={32} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="text-slate-400 group-hover:text-orange-500" size={32} />
                                            <span className="text-slate-500 group-hover:text-orange-600 font-medium">اضغط لرفع صورة</span>
                                        </>
                                    )}
                                    <input
                                        id="item-image"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                </div>
                            </div>
                        </form>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-6 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-all font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-orange-500 text-white px-8 py-2 rounded-xl flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                                {editingItem ? 'تحديث' : 'إضافة'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Utensils({ size, className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
            <path d="M7 2v20" />
            <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
    );
}
