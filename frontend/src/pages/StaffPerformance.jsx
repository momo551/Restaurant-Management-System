import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, Award, Clock, FileText } from 'lucide-react';
import DashboardSkeleton from '../components/Dashboard/DashboardSkeleton';

const StaffPerformance = () => {
    const [performanceData, setPerformanceData] = useState([]);
    const [deliveryPerformance, setDeliveryPerformance] = useState([]);
    const [period, setPeriod] = useState('30days');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, [period]);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [performanceRes, deliveryRes] = await Promise.all([
                axios.get(`/reports/staff_performance/?period=${period}`),
                axios.get(`/reports/delivery_performance/?period=${period}`)
            ]);
            setPerformanceData(performanceRes.data);
            setDeliveryPerformance(deliveryRes.data);
        } catch (err) {
            console.error('Error fetching staff performance:', err);
            setError('فشل في جلب بيانات أداء الموظفين');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPDF = async () => {
        try {
            const response = await axios.get(`/reports/staff_performance_pdf/?period=${period}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `staff_performance_${period}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error exporting PDF:', err);
            alert('فشل في تصدير ملف PDF');
        }
    };

    if (isLoading) return <DashboardSkeleton />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    // Derived Statistics
    const topPerformer = performanceData.length > 0 ? performanceData[0] : null;
    const totalSystemSales = performanceData.reduce((acc, curr) => acc + curr.total_sales, 0);
    const totalSystemOrders = performanceData.reduce((acc, curr) => acc + curr.total_orders, 0);

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">أداء طاقم العمل</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors font-medium"
                    >
                        <FileText className="w-4 h-4" />
                        تصدير PDF
                    </button>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    >
                        <option value="today">اليوم</option>
                        <option value="7days">آخر 7 أيام</option>
                        <option value="30days">آخر 30 يومًا</option>
                        <option value="90days">آخر 90 يومًا</option>
                        <option value="year">هذا العام</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {topPerformer && (
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/40 dark:to-orange-900/40 rounded-xl shadow-sm p-6 border border-yellow-100 dark:border-yellow-800/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
                                    <Award className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">نجم المبيعات المطلق</p>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{topPerformer.staff_name}</h3>
                                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mt-1">
                                    {topPerformer.total_sales.toFixed(2)} ج مبيعات
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">إجمالي المبيعات المحققة</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSystemSales.toFixed(2)} ج</h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الطلبات المسجلة</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSystemOrders} طلب</h3>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/40 rounded-lg">
                            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">المبيعات حسب الموظف</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...performanceData].sort((a, b) => b.total_sales - a.total_sales)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                                <XAxis dataKey="staff_name" tick={{ fill: '#9CA3AF' }} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value) => [`${value.toFixed(2)} ج`, 'المبيعات']}
                                />
                                <Bar dataKey="total_sales" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">عدد الطلبات حسب الموظف</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[...performanceData].sort((a, b) => b.total_orders - a.total_orders)}>
                                <defs>
                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                                <XAxis dataKey="staff_name" tick={{ fill: '#9CA3AF' }} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value) => [value, 'الطلبات']}
                                />
                                <Area type="monotone" dataKey="total_orders" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorOrders)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">قائمة كفاءة طاقم العمل والتصنيف</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">ترتيب</th>
                                <th className="px-6 py-4 font-medium">اسم الموظف</th>
                                <th className="px-6 py-4 font-medium">الدور الوظيفي</th>
                                <th className="px-6 py-4 font-medium text-center">إجمالي الطلبات</th>
                                <th className="px-6 py-4 font-medium text-center">المبيعات المحققة</th>
                                <th className="px-6 py-4 font-medium text-center">متوسط الفاتورة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {performanceData.map((staff, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-bold">#{index + 1}</td>
                                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300">
                                            {staff.staff_name.substring(0, 2).toUpperCase()}
                                        </div>
                                        {staff.staff_name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                                        <span className={`px-2 py-1 rounded text-xs ${staff.role === 'owner' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                                            {staff.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-purple-600 dark:text-purple-400">{staff.total_orders}  <span className="text-gray-400 text-xs">طلب</span></td>
                                    <td className="px-6 py-4 text-center font-bold text-blue-600 dark:text-blue-400">{staff.total_sales.toFixed(2)} <span className="text-gray-400 text-xs">ج.م</span></td>
                                    <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 font-medium">{staff.average_order_value.toFixed(2)} <span className="text-gray-400 text-xs">ج.م</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delivery Agent Performance Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">أداء مناديب التوصيل</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">المندوب</th>
                                <th className="px-6 py-4 font-medium text-center">عدد الطلبات المسلمة</th>
                                <th className="px-6 py-4 font-medium text-center">إجمالي رسوم التوصيل</th>
                                <th className="px-6 py-4 font-medium text-center">إجمالي العمولات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {deliveryPerformance.length > 0 ? (
                                deliveryPerformance.map((agent, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">{agent.agent_name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-bold">
                                                {agent.orders_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center font-medium text-gray-600 dark:text-gray-300">
                                            {agent.total_fees?.toFixed(2)} ج.م
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold text-orange-600 dark:text-orange-400">
                                            {agent.total_commissions?.toFixed(2)} ج.م
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                        لا توجد بيانات توصيل متاحة لهذه الفترة
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StaffPerformance;
