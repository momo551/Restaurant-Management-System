import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import { Shield, Download, Search, Filter, User, Clock, AlertCircle } from 'lucide-react';

const ACTION_COLORS = {
    price_change: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
    order_delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
    delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
    create: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
    order_create: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400',
    update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
    order_update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400',
    login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400',
    payment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
    discount_change: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400',
};

const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({ user: '', action: '', date_from: '', date_to: '' });
    const [expandedRow, setExpandedRow] = useState(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));
            const res = await axios.get('/users/activity-logs/', { params });
            setLogs(res.data.results || res.data);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogs();
        axios.get('/users/').then(r => setUsers(r.data.results || r.data)).catch(() => { });
    }, [fetchLogs]);

    const handleExportPDF = async () => {
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));
            const res = await axios.get('/users/activity-logs/export_pdf/', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('فشل تصدير PDF');
        }
    };

    const actionTypes = [
        { value: '', label: 'كل الإجراءات' },
        { value: 'price_change', label: 'تغيير سعر' },
        { value: 'order_delete', label: 'حذف طلب' },
        { value: 'delete', label: 'حذف' },
        { value: 'create', label: 'إنشاء' },
        { value: 'update', label: 'تعديل' },
        { value: 'payment', label: 'دفع' },
        { value: 'login', label: 'تسجيل دخول' },
    ];

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Shield className="text-blue-500" />
                    سجل المراجعة والتدقيق
                </h1>
                <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                    <Download size={16} />
                    تصدير PDF
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">المستخدم</label>
                        <select
                            value={filters.user}
                            onChange={e => setFilters(f => ({ ...f, user: e.target.value }))}
                            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                        >
                            <option value="">كل المستخدمين</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.first_name || u.username}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">نوع الإجراء</label>
                        <select
                            value={filters.action}
                            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                        >
                            {actionTypes.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">من تاريخ</label>
                        <input type="date" value={filters.date_from}
                            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">إلى تاريخ</label>
                        <input type="date" value={filters.date_to}
                            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                            className="w-full p-2 text-sm border rounded-lg dark:bg-gray-900/50 dark:border-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                        <Shield size={40} className="mb-3 opacity-40" />
                        <p>لا توجد سجلات بهذه المعايير</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="text-right p-4 font-medium">التاريخ</th>
                                <th className="text-right p-4 font-medium">المستخدم</th>
                                <th className="text-right p-4 font-medium">الإجراء</th>
                                <th className="text-right p-4 font-medium">النموذج</th>
                                <th className="text-right p-4 font-medium">الوصف</th>
                                <th className="text-right p-4 font-medium">التفاصيل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-4 text-gray-500 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString('ar-EG')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold">
                                                    {log.user_name?.[0] || '?'}
                                                </div>
                                                <span className="text-gray-800 dark:text-gray-200 font-medium">{log.user_name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                                                {log.action_display}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-gray-400">{log.model_name || '—'}</td>
                                        <td className="p-4 text-gray-700 dark:text-gray-300 max-w-xs truncate">{log.description || '—'}</td>
                                        <td className="p-4">
                                            {(log.old_data || log.new_data) && (
                                                <button
                                                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                                    className="text-blue-600 hover:text-blue-700 text-xs underline"
                                                >
                                                    {expandedRow === log.id ? 'إخفاء' : 'عرض التغييرات'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (log.old_data || log.new_data) && (
                                        <tr className="bg-blue-50 dark:bg-blue-900/10">
                                            <td colSpan={6} className="p-4">
                                                <div className="grid grid-cols-2 gap-4 text-xs">
                                                    <div>
                                                        <p className="font-bold text-red-600 dark:text-red-400 mb-2">قبل التعديل:</p>
                                                        <pre className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg overflow-auto text-red-800 dark:text-red-300">
                                                            {JSON.stringify(log.old_data, null, 2)}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-green-600 dark:text-green-400 mb-2">بعد التعديل:</p>
                                                        <pre className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg overflow-auto text-green-800 dark:text-green-300">
                                                            {JSON.stringify(log.new_data, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AuditLog;
