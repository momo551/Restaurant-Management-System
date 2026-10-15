import React, { useState, useEffect } from 'react';

const TokenMonitor = () => {
    const [tokens, setTokens] = useState({
        access: localStorage.getItem('access_token') || 'None',
        refresh: localStorage.getItem('refresh_token') || 'None'
    });

    // أنيميشن وميض خفيف لنلاحظ التغيير
    const [highlight, setHighlight] = useState(false);

    useEffect(() => {
        const handleStorageChange = () => {
            setTokens({
                access: localStorage.getItem('access_token') || 'None',
                refresh: localStorage.getItem('refresh_token') || 'None'
            });

            // تشغيل لون مختلف لثانية واحدة عند تحديث التوكن
            setHighlight(true);
            setTimeout(() => setHighlight(false), 1000);
        };

        // الرد على الحدث الذي أطلقناه في TokenService و أحداث الـ Storage العادية
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('tokensChanged', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('tokensChanged', handleStorageChange);
        };
    }, []);

    // لا تظهر المكون في وضع الـ Production السليم، مخصص للتطوير والمتابعة
    if (import.meta.env.MODE === 'production') return null;

    return (
        <div style={{
            position: 'fixed', bottom: 20, right: 20, width: '350px',
            background: highlight ? '#2b2bd5' : '#111',
            transition: 'background 0.3s ease',
            color: '#0f0', padding: '15px', borderRadius: '8px',
            zIndex: 9999, fontSize: '12px', wordWrap: 'break-word',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
        }}>
            <h4 style={{ margin: '0 0 10px 0', color: 'white' }}>🔍 Token Monitor (Auto Refresh)</h4>

            <p style={{ margin: '5px 0' }}>
                <strong style={{ color: 'yellow' }}>Access (First 25):</strong><br />
                {tokens.access !== 'None' ? tokens.access.substring(0, 25) + '...' : 'None'}
            </p>

            <p style={{ margin: '5px 0' }}>
                <strong style={{ color: 'gold' }}>Refresh (First 25):</strong><br />
                {tokens.refresh !== 'None' ? tokens.refresh.substring(0, 25) + '...' : 'None'}
            </p>
        </div>
    );
};

export default TokenMonitor;
