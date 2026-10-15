import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { AlertTriangle, TrendingDown, CheckCircle, Clock } from 'lucide-react';
import DashboardSkeleton from '../components/Dashboard/DashboardSkeleton';

const LowStockAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get('/stock/alerts/');
            setAlerts(response.data);
        } catch (err) {
            console.error('Error fetching low stock alerts:', err);
            setError('فشل في جلب تنبيهات النقص');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (id) => {
        try {
            await axios.post(`/stock/alerts/${id}/resolve/`);
            fetchAlerts(); // Refresh the list
        } catch (err) {
            console.error('Error resolving alert:', err);
            alert('حدث خطأ أثناء محاولة إغلاق التنبيه');
        }
    };

    if (isLoading) return <DashboardSkeleton />;
    if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

    const criticalAlerts = alerts.filter(a => parseFloat(a.current_quantity) === 0);
    const lowAlerts = alerts.filter(a => parseFloat(a.current_quantity) > 0);

    return (
        <div className="space-y-6 animate-fade-in fade-in">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="text-red-500" />
                    تنبيهات نقص المخزون الذكية
                </h1>
                <button
                    onClick={fetchAlerts}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors dark:bg-blue-900/40 dark:text-blue-400"
                >
                    <Clock size={16} />
                    تحديث
                </button>
            </div>

            {alerts.length === 0 ? (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-8 rounded-xl border border-green-200 dark:border-green-800 flex flex-col items-center justify-center text-center">
                    <CheckCircle className="w-16 h-16 mb-4 opacity-80" />
                    <h3 className="text-xl font-bold mb-2">المخزون بوضع ممتاز!</h3>
                    <p>لا توجد حالياً أي مكونات تحت حد إعادة الطلب.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {alerts.map((alert) => {
                        const isCritical = parseFloat(alert.current_quantity) === 0;
                        const shortage = parseFloat(alert.reorder_level) - parseFloat(alert.current_quantity);

                        return (
                            <div key={alert.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${isCritical ? 'border-red-500 dark:border-red-500/50 relative overflow-hidden' : 'border-gray-200 dark:border-gray-700'} p-6 transition-all hover:-translate-y-1 hover:shadow-md`}>
                                {isCritical && (
                                    <div className="absolute top-0 right-0 left-0 h-1 bg-red-500" />
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{alert.ingredient_name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            المورد: <span className="font-medium text-gray-700 dark:text-gray-300">{alert.supplier_name || 'غير محدد'}</span>
                                        </p>
                                    </div>
                                    <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'}`}>
                                        <TrendingDown size={20} />
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">الكمية الحالية:</span>
                                        <span className={`font-bold ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                            {parseFloat(alert.current_quantity).toFixed(2)} {alert.ingredient_unit}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">حد إعادة الطلب:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {parseFloat(alert.reorder_level).toFixed(2)} {alert.ingredient_unit}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">العجز التقديري:</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                            {shortage > 0 ? shortage.toFixed(2) : 0} {alert.ingredient_unit}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg transition-colors text-sm font-medium">
                                        إنشاء أمر شراء
                                    </button>
                                    <button
                                        onClick={() => handleResolve(alert.id)}
                                        className="flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                                    >
                                        تجاهل
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LowStockAlerts;
