import React from 'react';

export default function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse p-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-48"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl"></div>
                ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 h-[400px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl"></div>
                <div className="h-[400px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl"></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="h-[400px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl"></div>
            </div>
        </div>
    );
}
