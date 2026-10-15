import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

const ROLES = [
    { key: 'owner', label: 'مالك المطعم', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
    { key: 'manager', label: 'مدير', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
    { key: 'inventory_manager', label: 'مدير مخازن', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' },
    { key: 'cashier', label: 'كاشير', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
    { key: 'hall_manager', label: 'مدير صالة', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300' },
    { key: 'hall_captain', label: 'كابتن صالة', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300' },
    { key: 'kitchen', label: 'مطبخ', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300' },
    { key: 'delivery', label: 'دليفري', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' },
    { key: 'hr', label: 'موارد بشرية', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300' },
];

const PermissionsMatrix = () => {
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);

    useEffect(() => {
        fetchPermissions();
    }, []);

    const fetchPermissions = async () => {
        try {
            const res = await api.get('/users/permission-matrix/');
            setPermissions(res.data);
        } catch (err) {
            alert('فشل تحميل مصفوفة الصلاحيات');
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (role, module_key, currentAllowed) => {
        if (role === 'owner') return;
        
        const updateKey = `${role}-${module_key}`;
        setUpdating(updateKey);
        
        try {
            await api.post('/users/permission-matrix/toggle/', {
                role,
                module_key,
                allowed: !currentAllowed
            });
            
            setPermissions(prev => prev.map(p => 
                (p.role === role && p.module_key === module_key) 
                ? { ...p, allowed: !currentAllowed } 
                : p
            ));
            
        } catch (err) {
            alert('فشل تحديث الصلاحية');
        } finally {
            setUpdating(null);
        }
    };

    // Group permissions by module_key
    const modules = [...new Set(permissions.map(p => p.module_key))].map(key => {
        const perm = permissions.find(p => p.module_key === key);
        return {
            key,
            label: perm.module_label
        };
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-gray-500">جاري تحميل مصفوفة الصلاحيات...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="text-purple-500" />
                        مصفوفة الصلاحيات
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        إدارة صلاحيات الوصول للصفحات والمميزات لكل دور وظيفي
                    </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg text-sm border border-blue-100 dark:border-blue-800">
                    * التغييرات تطبق فوراً عند تحميل الصفحة للمستخدم
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-right p-4 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 sticky top-0 min-w-[220px]">
                                الصلاحية / الميزة
                            </th>
                            {ROLES.map(role => (
                                <th key={role.key} className="p-3 text-center bg-gray-50 dark:bg-gray-900/50 sticky top-0 min-w-[100px]">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${role.color}`}>
                                        {role.label}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {modules.map((mod, i) => (
                            <tr key={mod.key} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/20'}`}>
                                <td className="p-4 text-gray-800 dark:text-gray-200 font-medium">
                                    {mod.label}
                                </td>
                                {ROLES.map(role => {
                                    const perm = permissions.find(p => p.role === role.key && p.module_key === mod.key);
                                    const allowed = perm ? perm.allowed : (role.key === 'owner');
                                    const isUpdating = updating === `${role.key}-${mod.key}`;

                                    return (
                                        <td key={role.key} className="p-3 text-center">
                                            <button
                                                disabled={role.key === 'owner' || isUpdating}
                                                onClick={() => togglePermission(role.key, mod.key, allowed)}
                                                className={`p-2 rounded-lg transition-all ${role.key === 'owner' ? 'cursor-default' : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95'}`}
                                            >
                                                {isUpdating ? (
                                                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin mx-auto" />
                                                ) : allowed ? (
                                                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto" title="مسموح" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" title="ممنوع" />
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400 p-2">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span>مسموح (اضغط للتغيير)</span>
                </div>
                <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-gray-400" />
                    <span>ممنوع (اضغط للتغيير)</span>
                </div>
                <p className="text-xs text-purple-600 font-medium bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full">
                    * دور المالك يملك جميع الصلاحيات دائماً ولا يمكن تعديله
                </p>
            </div>
        </div>
    );
};

export default PermissionsMatrix;
