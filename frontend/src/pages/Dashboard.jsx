import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useThemeStore } from '../store/themeStore';
import DashboardSkeleton from '../components/Dashboard/DashboardSkeleton';
import StatsCards from '../components/Dashboard/StatsCards';
import SalesChart from '../components/Dashboard/SalesChart';
import TopItemsChart from '../components/Dashboard/TopItemsChart';
import RevenueChart from '../components/Dashboard/RevenueChart';
import { RefreshCw } from 'lucide-react';

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);
    const [hourlySales, setHourlySales] = useState([]);
    const [topItems, setTopItems] = useState([]);
    const [revenueData, setRevenueData] = useState([]);

    // eslint-disable-next-line no-unused-vars
    const { isDarkMode } = useThemeStore();

    useEffect(() => {
        fetchDashboardData(true);

        // Auto refresh every 10 seconds
        const intervalId = setInterval(() => {
            fetchDashboardData(false);
        }, 10000);

        return () => clearInterval(intervalId);
    }, []);

    const fetchDashboardData = async (initialLoad = false) => {
        try {
            if (initialLoad) setLoading(true);
            else setRefreshing(true);

            const [statsRes, hourlyRes, bestRes, revenueRes] = await Promise.all([
                api.get('/reports/dashboard_stats/'),
                api.get('/reports/hourly_sales/'),
                api.get('/reports/best_selling/'),
                api.get('/reports/sales_chart/')
            ]);

            setStats(statsRes.data);
            setHourlySales(hourlyRes.data);
            setTopItems(bestRes.data);
            setRevenueData(revenueRes.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-alexandria">مرحباً بك مجدداً! 👋</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">نظرة حية على أداء مطعمك اليوم.</p>
                </div>
                <div className="flex items-center gap-3">
                    {refreshing && <span className="text-xs text-orange-500 font-bold animate-pulse">جاري تحديث البيانات...</span>}
                    <button
                        onClick={() => fetchDashboardData(false)}
                        disabled={refreshing}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin text-orange-500' : ''} />
                        تحديث يدوي
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <StatsCards stats={stats} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Wide Chart: Sales per Hour */}
                <div className="xl:col-span-2">
                    <SalesChart data={hourlySales} />
                </div>

                {/* Sidebar Chart: Top Items */}
                <div>
                    <TopItemsChart data={topItems} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Secondary Chart: Daily Revenue */}
                <div className="w-full">
                    <RevenueChart data={revenueData} />
                </div>
            </div>
        </div>
    );
}
