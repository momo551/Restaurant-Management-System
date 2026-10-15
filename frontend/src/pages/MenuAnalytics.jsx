import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react';
import DashboardSkeleton from '../components/Dashboard/DashboardSkeleton';

const MenuAnalytics = () => {
    const [performanceData, setPerformanceData] = useState([]);
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
            const response = await axios.get(`/reports/menu_performance/?period=${period}`);
            setPerformanceData(response.data);
        } catch (err) {
            console.error('Error fetching menu analytics:', err);
            setError('فشل في جلب بيانات التحليلات');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <DashboardSkeleton />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    // Derived Statistics
    const topSelling = [...performanceData].sort((a, b) => b.total_quantity - a.total_quantity)[0];
    const topProfitable = [...performanceData].sort((a, b) => b.total_profit - a.total_profit)[0];
    const worstPerformer = [...performanceData].filter(i => i.abc_class === 'C').sort((a, b) => a.total_revenue - b.total_revenue)[0];

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">تحليلات الأداء (ABC) للمنيو</h1>
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {topSelling && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الأكثر مبيعاً</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{topSelling.name}</h3>
                                <p className="text-sm text-green-600 mt-1">{topSelling.total_quantity} طلب</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </div>
                )}
                {topProfitable && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الأعلى ربحية</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{topProfitable.name}</h3>
                                <p className="text-sm text-green-600 mt-1">{topProfitable.profit_margin.toFixed(2)} ج/وحدة</p>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/40 rounded-lg">
                                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </div>
                )}
                {worstPerformer && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">الأقل أداءً (فئة C)</p>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{worstPerformer.name}</h3>
                                <p className="text-sm text-red-600 mt-1">{worstPerformer.total_revenue} ج عوائد</p>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/40 rounded-lg">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">صافي الأرباح (Top 10)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...performanceData].sort((a, b) => b.total_profit - a.total_profit).slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                                <XAxis dataKey="name" tick={{ fill: '#9CA3AF' }} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value) => [`${value.toFixed(2)} ج`, 'الأرباح']}
                                />
                                <Bar dataKey="total_profit" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">العوائد الإجمالية (Top 10)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[...performanceData].slice(0, 10)}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                                <XAxis dataKey="name" tick={{ fill: '#9CA3AF' }} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                                    formatter={(value) => [`${value.toFixed(2)} ج`, 'الإيرادات']}
                                />
                                <Area type="monotone" dataKey="total_revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">تفاصيل أداء الأصناف (ABC Classification)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">الصنف</th>
                                <th className="px-6 py-4 font-medium">الكمية المباعة</th>
                                <th className="px-6 py-4 font-medium">الإيرادات</th>
                                <th className="px-6 py-4 font-medium">تكلفة الوحدة</th>
                                <th className="px-6 py-4 font-medium">هامش الربح</th>
                                <th className="px-6 py-4 font-medium">إجمالي الأرباح</th>
                                <th className="px-6 py-4 font-medium text-center">التصنيف (ABC)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {performanceData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">{item.name}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.total_quantity}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.total_revenue.toFixed(2)} ج</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{item.production_cost.toFixed(2)} ج</td>
                                    <td className="px-6 py-4 text-green-600 font-medium">{item.profit_margin.toFixed(2)} ج</td>
                                    <td className="px-6 py-4 text-green-600 font-bold">{item.total_profit.toFixed(2)} ج</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.abc_class === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                                            item.abc_class === 'B' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                            }`}>
                                            Type {item.abc_class}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MenuAnalytics;
