import React, { useState, useEffect } from 'react';
import stockApi from '../api/stock';
import api from '../api/axios';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Trash2, Eye, Calculator, TrendingUp, DollarSign, Package, AlertCircle } from 'lucide-react';

export default function RecipesPage() {
    const [groupedRecipes, setGroupedRecipes] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [recipeIngredients, setRecipeIngredients] = useState([]); // [{ingredient: '', quantity_required: ''}]
    const [selectedMenuItem, setSelectedMenuItem] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [groupedRes, ingsRes, menuRes] = await Promise.all([
                stockApi.getGroupedRecipes(),
                stockApi.getIngredients({ page_size: 100 }),
                api.get('/menu/items/')
            ]);
            setGroupedRecipes(groupedRes.data);
            setIngredients(ingsRes.data.results || ingsRes.data);
            setMenuItems(menuRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDetails = (product) => {
        setSelectedProduct(product);
        setIsDetailModalOpen(true);
    };

    const handleOpenEditForm = (groupedRecipe = null) => {
        if (groupedRecipe) {
            setSelectedMenuItem(groupedRecipe.id); // menu_item id
            setRecipeIngredients(groupedRecipe.ingredients.map(ing => ({
                ingredient: ing.ingredient,
                quantity_required: ing.quantity_required,
                unit: ingredients.find(i => i.id === ing.ingredient)?.unit || ''
            })));
        } else {
            setSelectedMenuItem('');
            setRecipeIngredients([{ ingredient: '', quantity_required: '', unit: '' }]);
        }
        setIsFormModalOpen(true);
    };

    const handleAddRow = () => {
        setRecipeIngredients([...recipeIngredients, { ingredient: '', quantity_required: '', unit: '' }]);
    };

    const handleRemoveRow = (index) => {
        const updated = [...recipeIngredients];
        updated.splice(index, 1);
        setRecipeIngredients(updated);
    };

    const handleIngredientChange = (index, field, value) => {
        const updated = [...recipeIngredients];
        updated[index][field] = value;

        if (field === 'ingredient') {
            const ing = ingredients.find(i => i.id === parseInt(value));
            updated[index].unit = ing ? ing.unit : '';
        }

        setRecipeIngredients(updated);
    };

    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                menu_item: selectedMenuItem,
                ingredients: recipeIngredients.filter(ri => ri.ingredient && ri.quantity_required)
            };

            await stockApi.updateRecipeBulk(payload);
            fetchData();
            setIsFormModalOpen(false);

            if (selectedProduct && selectedProduct.id === parseInt(selectedMenuItem)) {
                const { data } = await stockApi.getGroupedRecipes();
                const updated = data.find(p => p.id === selectedProduct.id);
                setSelectedProduct(updated);
            }
        } catch (error) {
            alert('خطأ في حفظ البيانات');
        }
    };

    const handleDeleteRecipeItem = async (id) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المكون من الوصفة؟')) {
            try {
                await stockApi.deleteRecipe(id);
                const { data } = await stockApi.getGroupedRecipes();
                setGroupedRecipes(data);
                if (selectedProduct) {
                    const updated = data.find(p => p.id === selectedProduct.id);
                    setSelectedProduct(updated || null);
                    if (!updated) setIsDetailModalOpen(false);
                }
            } catch (error) {
                alert('حدث خطأ أثناء الحذف');
            }
        }
    };

    const calculateCurrentTotal = () => {
        return recipeIngredients.reduce((total, ri) => {
            const ing = ingredients.find(i => i.id === parseInt(ri.ingredient));
            if (ing && ri.quantity_required) {
                return total + (parseFloat(ri.quantity_required) * parseFloat(ing.last_purchase_price || 0));
            }
            return total;
        }, 0).toFixed(2);
    };

    const stats = [
        { label: 'إجمالي الوصفات', value: groupedRecipes.length, icon: <Package className="text-blue-600" />, color: 'bg-blue-50' },
        {
            label: 'متوسط التكلفة',
            value: groupedRecipes.length > 0
                ? (groupedRecipes.reduce((acc, curr) => acc + parseFloat(curr.total_cost), 0) / groupedRecipes.length).toFixed(2)
                : '0.00',
            icon: <DollarSign className="text-green-600" />,
            color: 'bg-green-50'
        },
        {
            label: 'أعلى تكلفة انتاج',
            value: groupedRecipes.length > 0
                ? Math.max(...groupedRecipes.map(r => parseFloat(r.total_cost))).toFixed(2)
                : '0.00',
            icon: <TrendingUp className="text-orange-600" />,
            color: 'bg-orange-50'
        }
    ];

    const mainColumns = [
        {
            header: 'اسم الصنف (Menu Item)', accessor: 'menu_item_name', render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                        {row.menu_item_name.charAt(0)}
                    </div>
                    <span className="font-bold text-slate-800">{row.menu_item_name}</span>
                </div>
            )
        },
        {
            header: 'تكلفة الإنتاج', accessor: 'total_cost', render: (row) => (
                <div className="flex items-center gap-2 font-bold text-orange-600 font-sans">
                    <Calculator size={16} />
                    <span>{parseFloat(row.total_cost).toFixed(2)} ج.م</span>
                </div>
            )
        },
        {
            header: 'عدد المكونات', render: (row) => (
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
                    {row.ingredients.length} مكونات
                </span>
            )
        },
        {
            header: 'إجراءات', render: (row) => (
                <div className="flex gap-2 justify-end">
                    <button onClick={() => handleOpenDetails(row)} className="flex items-center gap-1 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all text-xs font-bold shadow-sm">
                        <Eye size={16} />
                        التفاصيل
                    </button>
                    <button onClick={() => handleOpenEditForm(row)} className="flex items-center gap-1 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all text-xs font-bold">
                        <Plus size={16} />
                        تعديل المكونات
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-6 text-right pb-10" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-200">
                        <Calculator size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">حساب تكاليف الوصفات</h1>
                        <p className="text-slate-500 font-medium mt-1">إدارة المكونات الخام وحساب دقيق لتكلفة الطبق</p>
                    </div>
                </div>
                <button onClick={() => handleOpenEditForm()} className="flex items-center gap-3 px-8 py-4 bg-orange-600 text-white rounded-2xl hover:bg-orange-700 transition-all font-bold shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-[0.98]">
                    <Plus size={24} />
                    إضافة وصفة جديدة
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
                            <p className="text-sm font-bold text-slate-400">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800 font-sans mt-1">
                                {stat.value} {idx > 0 && <span className="text-sm font-bold text-slate-400">ج.م</span>}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Data Stage */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-32">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600"></div>
                            <Calculator className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-200" size={20} />
                        </div>
                    </div>
                ) : (
                    <Table
                        columns={mainColumns}
                        data={groupedRecipes}
                    />
                )}
            </div>

            {/* Details Modal */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title={`وصفة: ${selectedProduct?.menu_item_name}`}
            >
                <div className="space-y-8">
                    <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-3xl border border-orange-200/50 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-bold text-orange-800 mb-1">إجمالي تكلفة المكونات</p>
                            <p className="text-4xl font-black text-orange-600 font-sans">{parseFloat(selectedProduct?.total_cost || 0).toFixed(2)} <span className="text-lg">ج.م</span></p>
                        </div>
                        <button onClick={() => handleOpenEditForm(selectedProduct)} className="p-4 bg-white text-orange-600 rounded-2xl shadow-md hover:shadow-lg transition-all hover:scale-105">
                            <Plus size={24} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b pb-4">
                            <AlertCircle size={20} className="text-slate-400" />
                            <h4 className="font-black text-slate-800 text-lg">تحليل المكونات</h4>
                        </div>
                        <div className="grid gap-3">
                            {selectedProduct?.ingredients.map((ing) => (
                                <div key={ing.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-orange-200 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-white rounded-lg border text-slate-400 group-hover:text-orange-500 group-hover:border-orange-100 transition-all">
                                            <Package size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{ing.ingredient_name}</p>
                                            <p className="text-xs text-slate-500 font-medium">{ing.quantity_required} وحدة مطلوبة</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-left font-sans">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">التكلفة الفرعية</p>
                                            <p className="text-lg font-black text-slate-700">{(ing.quantity_required * (ing.ingredient_cost || 0)).toFixed(2)} ج.م</p>
                                        </div>
                                        <button onClick={() => handleDeleteRecipeItem(ing.id)} className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Edit Form Modal */}
            <Modal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                title={selectedMenuItem ? "تعديل مكونات الوصفة" : "إضافة وصفة جديدة"}
                size="max-w-4xl"
            >
                <form onSubmit={handleSaveRecipe} className="space-y-8 text-right pb-2">
                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <label className="block text-sm font-bold text-slate-700 mb-3">صنف المنيو الأساسي</label>
                            <select
                                required
                                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
                                value={selectedMenuItem}
                                onChange={(e) => setSelectedMenuItem(e.target.value)}
                                disabled={!!selectedMenuItem && groupedRecipes.some(r => r.id === parseInt(selectedMenuItem))}
                            >
                                <option value="">اختار الصنف من المنيو...</option>
                                {menuItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-2">
                                <h3 className="font-black text-slate-800">مكونات الوصفة</h3>
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all font-bold text-sm"
                                >
                                    <Plus size={18} />
                                    إضافة مكون
                                </button>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {recipeIngredients.map((row, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-3 items-end p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-orange-200 transition-all">
                                        <div className="col-span-12 md:col-span-5">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase pr-1">المكون الخام</label>
                                            <select
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none font-bold text-slate-700 text-sm"
                                                value={row.ingredient}
                                                onChange={(e) => handleIngredientChange(index, 'ingredient', e.target.value)}
                                            >
                                                <option value="">اختار المكون...</option>
                                                {ingredients.map(ing => (
                                                    <option key={ing.id} value={ing.id} disabled={recipeIngredients.some((ri, i) => i !== index && parseInt(ri.ingredient) === ing.id)}>
                                                        {ing.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-8 md:col-span-4">
                                            <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase pr-1">الكمية المطلوبة ({row.unit || '---'})</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none font-sans font-bold text-slate-700 text-sm"
                                                value={row.quantity_required}
                                                onChange={(e) => handleIngredientChange(index, 'quantity_required', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-4 md:col-span-3 flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(index)}
                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {recipeIngredients.length === 0 && (
                                    <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                            <AlertCircle size={24} />
                                        </div>
                                        <p className="text-slate-500 font-bold">لا يوجد مكونات مضافة بعد لهذه الوصفة</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-gradient-to-l from-slate-800 to-slate-900 rounded-3xl flex justify-between items-center text-white shadow-xl">
                            <div>
                                <p className="text-xs font-bold text-slate-400 mb-1">إجمالي تكلفة المكونات الحالية</p>
                                <p className="text-3xl font-black font-sans">{calculateCurrentTotal()} <span className="text-sm font-bold">ج.م</span></p>
                            </div>
                            <Calculator size={32} className="opacity-20" />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button type="submit" className="flex-[2] bg-orange-600 text-white py-5 rounded-2xl hover:bg-orange-700 transition-all font-black shadow-xl shadow-orange-100 active:scale-95 text-lg">
                            حفظ الوصفة بالكامل
                        </button>
                        <button type="button" onClick={() => setIsFormModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-5 rounded-2xl hover:bg-slate-200 transition-all font-black active:scale-95">
                            إلغاء التعديلات
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
