import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, AlertCircle } from 'lucide-react';

export default function QRRedirect() {
    const { code } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);

    useEffect(() => {
        const initSession = async () => {
            try {
                // 1. Get table info from QR code
                const tableRes = await api.get(`/tables/from-qr/${code}/`);
                const tableData = tableRes.data;

                // 2. Create or get existing session for this table
                const sessionRes = await api.post(`/tables/sessions/create_session/`, { table_id: tableData.id });
                
                // In the Admin/POS app, we don't have a customer menu route usually, 
                // but we might want to redirect to the POS with this table selected.
                // For now, let's just show a success message or redirect to dashboard
                // as this app is for EMPLOYEES, not CUSTOMERS.
                
                alert(`تم التحقق من الطاولة رقم ${tableData.number}. هذا الرابط مخصص لطلب العملاء.`);
                navigate('/');
            } catch (err) {
                console.error('QR Session Init Failed', err);
                const backendError = err.response?.data?.error || err.response?.data?.detail || err.message;
                const traceback = err.response?.data?.traceback;
                if (traceback) console.error('Backend Traceback:', traceback);
                setError(traceback ? `خطأ في السيرفر: ${backendError}\n\n${traceback.split('\n').slice(-3).join('\n')}` : `فشل التحميل: ${backendError}`);
            }
        };

        if (code) {
            initSession();
        }
    }, [code, navigate]);

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">خطأ في المسح</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2 bg-orange-500 text-white rounded-full font-bold shadow-lg"
                >
                    العودة للرئيسية
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">جاري التحقق من الطاولة...</h1>
            <p className="text-gray-500 dark:text-gray-400">يرجى الانتظار لحظات، سنقوم بتحويلك للمنيو.</p>
        </div>
    );
}
