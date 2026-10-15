import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useThemeStore } from '../../store/themeStore';

export default function RevenueChart({ data }) {
    const { isDarkMode } = useThemeStore();

    // Select last 7 days and format day name in Arabic
    const getArabicDayName = (dateString) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(date);
        } catch {
            return dateString;
        }
    };

    const chartData = data?.slice(-7).map(item => ({
        ...item,
        dayStr: getArabicDayName(item.day)
    })) || [];

    const tooltipStyle = {
        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
        borderRadius: '12px',
        color: isDarkMode ? '#f1f5f9' : '#0f172a',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        padding: '12px',
        textAlign: 'right'
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 h-[400px] w-full flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 font-alexandria">الإيرادات اليومية (آخر 7 أيام)</h3>
            <div className="flex-1 min-h-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="dayStr" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val} ج`} dx={-10} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }} formatter={(value) => [value, 'الإيرادات']} labelFormatter={(label) => `يوم ${label}`} />
                        <Bar dataKey="total_sales" name="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
