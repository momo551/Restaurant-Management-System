import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useThemeStore } from '../../store/themeStore';

export default function SalesChart({ data }) {
    const { isDarkMode } = useThemeStore();

    // Formatting data for chart
    const chartData = data?.map(item => ({
        ...item,
        // Shorten time format if needed, already comes as 'HH:00' from backend
    })) || [];

    const tooltipStyle = {
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
        borderRadius: '12px',
        color: isDarkMode ? '#f1f5f9' : '#0f172a',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        padding: '12px',
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 h-[400px] w-full flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 font-alexandria">مبيعات اليوم بالساعة</h3>
            <div className="flex-1 min-h-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="hour" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val} ج`} dx={-10} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f97316', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="total_sales" name="المبيعات" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
