import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import {
    Trash2, Plus, AlertCircle, TrendingUp, Calendar,
    DollarSign, PackageX
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import DashboardSkeleton from '../components/Dashboard/DashboardSkeleton';

const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

const WasteManagement = () => {
    const [analytics, setAnalytics] = useState(null);
    const [ingredients, setIngredients] = useState([]);
    const [period, setPeriod] = useState(30);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        ingredient: '',
        quantity: '',
        reason: 'kitchen_waste'
    });
    const [formError, setFormError] = useState('');

    useEffect(() => {
        fetchData();
        fetchIngredients();
    }, [period]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`/stock/waste/analytics/?days=${period}`);
            setAnalytics(response.data);
        } catch (err) {
            console.error('Error fetching waste analytics:', err);
            setError('فشل في جلب بيانات الهالك');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchIngredients = async () => {
        try {
            const res = await axios.get('/stock/ingredients/');
            setIngredients(res.data.results || res.data);
        } catch (err) {
            console.error('Failed to load ingredients', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        try {
            await axios.post('/stock/waste/', formData);
            setShowModal(false);
            setFormData({ ingredient: '', quantity: '', reason: 'kitchen_waste' });
            fetchData(); // Refresh analytics
        } catch (err) {
            console.error(err);
            setFormError(err.response?.data?.non_field_errors?.[0] || 'تأكد من وجود كمية كافية في المخزون لخصمها.');
        }
    };

    if (isLoading && !analytics) return <DashboardSkeleton />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Trash2 className="text-red-500" />
                        إدارة الهالك والمفقودات
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        متابعة تسجيل الهادر وتكلفته المالية
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(Number(e.target.value))}
                        className="p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
                    >
                        <option value={7}>آخر 7 أيام</option>
                        <option value={30}>آخر 30 يومًا</option>
                        <option value={90}>آخر 90 يومًا</option>
                    </select>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm"
                    >
                        <Plus size={16} />
                        تسجيل هالك جديد
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">إجمالي التكلفة المهدرة</p>
                            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                {analytics?.total_financial_loss?.toFixed(2)} ج
                            </h3>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/40 rounded-lg">
                            <DollarSign className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">عدد حركات الإهلاك</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {analytics?.logs_count} حركة
                            </h3>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/40 rounded-lg">
                            <PackageX className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">أكثر صنف تم هدره</p>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                                {analytics?.top_wasted_ingredients?.[0]?.ingredient__name || 'لا يوجد'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {analytics?.top_wasted_ingredients?.[0]?.total_qty?.toFixed(2) || 0} وحدة
                            </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">أسباب الهالك</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics?.reasons_distribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="total_qty"
                                    nameKey="reason"
                                >
                                    {analytics?.reasons_distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value, name) => [value.toFixed(2), name === 'expired' ? 'منتهي الصلاحية' : name === 'damaged' ? 'تالف' : name === 'kitchen_waste' ? 'هالك مطبخ' : 'تعديل جرد']}
                                />
                                <Legend formatter={(value) => value === 'expired' ? 'منتهي الصلاحية' : value === 'damaged' ? 'تالف' : value === 'kitchen_waste' ? 'هالك مطبخ' : 'تعديل جرد'} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">أكثر 10 مكونات هدرًا (كميات)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics?.top_wasted_ingredients}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                                <XAxis dataKey="ingredient__name" tick={{ fill: '#9CA3AF' }} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value) => [`${value.toFixed(2)}`, 'الكمية']}
                                />
                                <Bar dataKey="total_qty" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Modal for new Waste Log */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl" dir="rtl">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">تسجيل هالك للمكونات</h2>

                        {formError && (
                            <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                                <AlertCircle size={16} />
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المكون (الصنف)</label>
                                <select
                                    required
                                    value={formData.ingredient}
                                    onChange={(e) => setFormData({ ...formData, ingredient: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                                >
                                    <option value="">اختر المكون...</option>
                                    {ingredients.map(ing => (
                                        <option key={ing.id} value={ing.id}>
                                            {ing.name} (المتاح: {ing.quantity} {ing.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الكمية المهدرة</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    required
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                                    placeholder="مثال: 1.5"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">سبب الهالك</label>
                                <select
                                    required
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full p-2.5 border rounded-lg bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                                >
                                    <option value="kitchen_waste">خطأ تصنيع / هالك مطبخ</option>
                                    <option value="expired">منتهي الصلاحية</option>
                                    <option value="damaged">تالف / سوء تخزين</option>
                                    <option value="inventory_adjustment">تسوية جرد سنوي</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                                >
                                    تأكيد الخصم وتسجيل الهالك
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WasteManagement;
