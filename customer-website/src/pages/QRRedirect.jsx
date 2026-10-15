import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { publicApi } from '../api/publicApi';
import { useSessionStore } from '../store/sessionStore';
import { restaurantPath } from '../restaurantContext';
import { Loader2, AlertCircle } from 'lucide-react';

export default function QRRedirect() {
    const { code } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const { setTableInfo, setSessionToken } = useSessionStore();

    useEffect(() => {
        const initSession = async () => {
            try {
                // 1. Get table info from QR code
                const tableRes = await publicApi.getTableFromQR(code);
                const tableData = tableRes.data;
                setTableInfo(tableData);

                // 2. Create or get existing session for this table with restaurant context
                const sessionRes = await publicApi.createSession(tableData.id, tableData.restaurant_slug);
                setSessionToken(sessionRes.data.session_token);

                // 3. Redirect to menu
                navigate(restaurantPath(tableData.restaurant_slug, '/menu'));
            } catch (err) {
                console.error('QR Session Init Failed', err);
                setError('كود الـ QR غير صالح أو منتهي الصلاحية.');
            }
        };

        if (code) {
            initSession();
        }
    }, [code]);

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
