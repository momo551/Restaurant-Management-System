import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import useStore from '../store/useStore';

export default function Unauthorized() {
    const navigate = useNavigate();
    const { logout, user } = useStore();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 text-center border border-slate-100">
                <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert className="w-10 h-10 text-red-500" />
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-2">وصول غير مصرح به</h1>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    عذراً، لا تملك الصلاحيات الكافية للوصول إلى هذه الصفحة.
                    <br />
                    <span className="text-slate-400 text-sm">(الدور الحالي: {user?.role_display || user?.role})</span>
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        الرجوع للخلف
                    </button>

                    <button
                        onClick={() => logout()}
                        className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 font-semibold py-3 px-6 rounded-xl border border-slate-200 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        تسجيل الخروج
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                    <p className="text-sm text-slate-400">
                        إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع مسؤول النظام.
                    </p>
                </div>
            </div>
        </div>
    );
}
