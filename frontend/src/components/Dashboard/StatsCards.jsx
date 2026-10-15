import React from 'react';
import { DollarSign, ShoppingCart, Activity, TrendingUp } from 'lucide-react';

export default function StatsCards({ stats }) {
    if (!stats) return null;

    const cards = [
        {
            title: 'إجمالي المبيعات (اليوم)',
            value: `${stats.today_sales} ج.م`,
            trend: stats.today_sales_trend,
            icon: <DollarSign className="text-orange-500" />,
            bg: 'bg-orange-50 dark:bg-orange-500/10'
        },
        {
            title: 'عدد الطلبات',
            value: stats.today_orders_count,
            trend: stats.today_orders_trend,
            icon: <ShoppingCart className="text-blue-500" />,
            bg: 'bg-blue-50 dark:bg-blue-500/10'
        },
        {
            title: 'الطلبات النشطة',
            value: stats.pending_orders,
            trend: stats.pending_orders_trend,
            icon: <Activity className="text-purple-500" />,
            bg: 'bg-purple-50 dark:bg-purple-500/10'
        },
        {
            title: 'متوسط قيمة الطلب',
            value: `${stats.today_orders_count > 0 ? (stats.today_sales / stats.today_orders_count).toFixed(2) : 0} ج.م`,
            trend: null,
            icon: <TrendingUp className="text-green-500" />,
            bg: 'bg-green-50 dark:bg-green-500/10'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-300">
                    <div className={`p-4 rounded-xl ${card.bg}`}>
                        {card.icon}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{card.title}</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{card.value}</p>
                        {card.trend !== null && (
                            <p className={`text-xs mt-1 font-bold ${card.trend > 0 ? 'text-green-500' : card.trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                {card.trend > 0 ? '↑' : card.trend < 0 ? '↓' : '-'} {Math.abs(card.trend)}% من الأمس
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
