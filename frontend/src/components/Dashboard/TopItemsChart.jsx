import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useThemeStore } from '../../store/themeStore';

export default function TopItemsChart({ data }) {
    const { isDarkMode } = useThemeStore();
    const colors = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4', '#f43f5e', '#84cc16', '#a855f7'];

    // Formatting data for chart
    const chartData = data?.map(item => ({
        name: item.menu_item__name,
        // Shorten long names
        shortName: item.menu_item__name.length > 15 ? item.menu_item__name.substring(0, 15) + '...' : item.menu_item__name,
        qty: item.total_quantity
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
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6 font-alexandria">الأصناف الأكثر مبيعاً (30 يوم)</h3>
            <div className="flex-1 min-h-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis type="number" stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis dataKey="shortName" type="category" width={100} stroke={isDarkMode ? '#94a3b8' : '#64748b'} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: isDarkMode ? '#334155' : '#f1f5f9' }} formatter={(value) => [value, 'الكمية المباعة']} labelFormatter={(label) => `الصنف: ${label}`} />
                        <Bar dataKey="qty" name="الكمية" radius={[0, 4, 4, 0]} barSize={20}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
