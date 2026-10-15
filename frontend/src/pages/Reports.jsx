import { useState, useEffect, useRef } from 'react';
import {
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Users,
    Calendar,
    Download,
    ArrowUpRight,
    ArrowDownRight,
    Package,
    TrendingDown
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import api from '../api/axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

const StatCard = ({ title, value, icon, color, trend, trendValue }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-lg hover:-translate-y-1 group">
        <div className="flex items-start justify-between">
            <div className="flex-1">
                <p className="text-slate-500 text-sm mb-2">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800 mb-3">{value}</h3>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span>{Math.abs(trend)}%</span>
                        <span className="text-slate-400 text-xs mr-1">من الأمس</span>
                    </div>
                )}
            </div>
            <div className={`p-4 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
        </div>
    </div>
);

const BestSellingItem = ({ item, index }) => (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all group">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
            index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                    'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600'
            }`}>
            {index + 1}
        </div>
        <div className="flex-1">
            <h4 className="font-semibold text-slate-800 mb-1">{item.menu_item__name}</h4>
            <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">الكمية: {item.total_quantity}</span>
                <span className="text-orange-600 font-medium">{item.total_revenue?.toFixed(2)} ج.م</span>
            </div>
        </div>
        <div className="text-right">
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((item.total_quantity / 100) * 100, 100)}%` }}
                />
            </div>
        </div>
    </div>
);

const SimpleReport = ({ stats, salesData, bestSelling, deliveryPerformance }) => (
    <div style={{ padding: '40px', backgroundColor: 'white', color: '#1e293b', direction: 'rtl', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #f97316', paddingBottom: '20px' }}>
            <h1 style={{ fontSize: '28px', color: '#1e293b', marginBottom: '10px' }}>تقرير المبيعات والتحليلات</h1>
            <p style={{ color: '#64748b' }}>مطعمنا - تقرير آلي</p>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>تاريخ التصدير: {new Date().toLocaleDateString('ar-EG')} {new Date().toLocaleTimeString('ar-EG')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '40px' }}>
            <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '5px' }}>مبيعات اليوم</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats?.today_sales?.toFixed(2) || '0.00'} ج.م</h3>
            </div>
            <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '5px' }}>عدد الطلبات اليوم</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats?.today_orders_count || 0}</h3>
            </div>
            <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '5px' }}>الطلبات المعلقة</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats?.pending_orders || 0}</h3>
            </div>
            <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '5px' }}>إجمالي الزوار اليوم</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{stats?.total_customers_today || 0}</h3>
            </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>الأصناف الأكثر مبيعاً</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>الصنف</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>الكمية</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    {bestSelling.map((item, index) => (
                        <tr key={index}>
                            <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{item.menu_item__name}</td>
                            <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{item.total_quantity}</td>
                            <td style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>{item.total_revenue?.toFixed(2)} ج.م</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '20px' }}>ملخص مبيعات آخر فترة</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>التاريخ</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>عدد الطلبات</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>المبيعات</th>
                    </tr>
                </thead>
                <tbody>
                    {salesData.slice(-10).reverse().map((data, index) => (
                        <tr key={index}>
                            <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{data.date}</td>
                            <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{data.orders}</td>
                            <td style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>{data.sales.toFixed(2)} ج.م</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

    </div>
);

export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [stats, setStats] = useState(null);
    const [salesData, setSalesData] = useState([]);
    const [bestSelling, setBestSelling] = useState([]);
    const [dateRange, setDateRange] = useState('30days');
    const containerRef = useRef(null);
    const reportRef = useRef(null);

    useEffect(() => {
        fetchReportsData(dateRange);
    }, [dateRange]);

    const exportToPDF = async () => {
        try {
            setExporting(true);

            // Wait for a flicker to ensure the hidden element is available
            await new Promise(resolve => setTimeout(resolve, 100));

            const element = reportRef.current;
            element.style.display = 'block'; // Temporarily show for capture

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: 'white',
                width: 800
            });

            element.style.display = 'none'; // Hide again

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`تقرير-الأداء-${new Date().toLocaleDateString('ar-EG')}.pdf`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('حدث خطأ أثناء تصدير التقرير البسيط. يرجى المحاولة مرة أخرى.');
        } finally {
            setExporting(false);
            if (reportRef.current) reportRef.current.style.display = 'none';
        }
    };

    const fetchReportsData = async (period = '30days') => {
        try {
            setLoading(true);
            console.log(`Fetching reports data for period: ${period}...`);

            // Fetch dashboard stats (usually remains for "today")
            const statsRes = await api.get('/reports/dashboard_stats/');
            console.log('Stats response:', statsRes.data);
            setStats(statsRes.data);

            // Fetch sales chart data with period
            const salesRes = await api.get(`/reports/sales_chart/?period=${period}`);
            console.log('Sales response:', salesRes.data);
            const formattedSales = salesRes.data.map(item => ({
                date: new Date(item.day).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                sales: parseFloat(item.total_sales || 0),
                orders: item.order_count
            }));
            setSalesData(formattedSales);

            // Fetch best selling items with period
            const bestRes = await api.get(`/reports/best_selling/?period=${period}`);
            console.log('Best selling response:', bestRes.data);
            setBestSelling(bestRes.data);

            console.log('All data fetched successfully');
        } catch (error) {
            console.error('Error fetching reports:', error);
            console.error('Error details:', error.response?.data);
            alert('حدث خطأ في تحميل التقارير. يرجى التحقق من Console للتفاصيل.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">جاري تحميل التقارير...</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="space-y-8 animate-in fade-in duration-500 p-4 bg-slate-50 min-h-screen">
            {/* Hidden Simple Report for Export */}
            <div style={{ position: 'absolute', left: '-9999px', top: '0', width: '800px' }}>
                <div ref={reportRef} style={{ display: 'none' }}>
                    <SimpleReport
                        stats={stats}
                        salesData={salesData}
                        bestSelling={bestSelling}
                    />
                </div>
            </div>


            {/* Header */}
            <div className="flex items-center justify-between font-arabic">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">📊 التقارير والتحليلات</h1>
                    <p className="text-slate-500">نظرة شاملة على أداء المطعم والمبيعات</p>
                </div>
                <div className="flex gap-3">
                    <select
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium bg-white hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="7days">آخر 7 أيام</option>
                        <option value="30days">آخر 30 يوم</option>
                        <option value="90days">آخر 3 شهور</option>
                        <option value="year">هذا العام</option>
                    </select>
                    <button
                        onClick={exportToPDF}
                        disabled={exporting}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {exporting ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Download size={18} />
                        )}
                        {exporting ? 'جاري التصدير...' : 'تصدير التقرير المبسط (PDF)'}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="مبيعات اليوم"
                    value={`${stats?.today_sales?.toFixed(2) || '0.00'} ج.م`}
                    icon={<DollarSign size={24} />}
                    color="bg-gradient-to-br from-orange-500 to-orange-600"
                    trend={stats?.today_sales_trend}
                />
                <StatCard
                    title="عدد الطلبات اليوم"
                    value={stats?.today_orders_count || 0}
                    icon={<ShoppingBag size={24} />}
                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                    trend={stats?.today_orders_trend}
                />
                <StatCard
                    title="الطلبات المعلقة"
                    value={stats?.pending_orders || 0}
                    icon={<Package size={24} />}
                    color="bg-gradient-to-br from-purple-500 to-purple-600"
                    trend={stats?.pending_orders_trend}
                />
                <StatCard
                    title="إجمالي الزوار اليوم"
                    value={stats?.total_customers_today || 0}
                    icon={<Users size={24} />}
                    color="bg-gradient-to-br from-green-500 to-green-600"
                    trend={stats?.total_customers_trend}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sales Trend Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg mb-1">تحليل المبيعات</h3>
                            <p className="text-slate-500 text-sm">اتجاه المبيعات خلال آخر 30 يوم</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600"></span>
                                <span className="text-slate-600">المبيعات</span>
                            </span>
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        padding: '12px'
                                    }}
                                    labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#f97316"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Best Selling Items */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 text-lg mb-1">الأصناف الأكثر مبيعاً</h3>
                        <p className="text-slate-500 text-sm">أفضل 10 أصناف</p>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                        {bestSelling.length > 0 ? (
                            bestSelling.slice(0, 10).map((item, index) => (
                                <BestSellingItem key={index} item={item} index={index} />
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <p>لا توجد بيانات متاحة</p>
                                <p className="text-sm mt-2">قم بإضافة طلبات لعرض الأصناف الأكثر مبيعاً</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Orders Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 text-lg mb-1">عدد الطلبات</h3>
                        <p className="text-slate-500 text-sm">توزيع الطلبات خلال الفترة</p>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Bar dataKey="orders" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue Distribution */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-800 text-lg mb-1">توزيع الإيرادات</h3>
                        <p className="text-slate-500 text-sm">حسب الأصناف الأكثر مبيعاً</p>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={bestSelling.slice(0, 6)}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ menu_item__name, percent }) => `${menu_item__name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="total_revenue"
                                >
                                    {bestSelling.slice(0, 6).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>


            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            `}</style>
        </div>
    );
}
