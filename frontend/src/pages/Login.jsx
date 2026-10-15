import { useState } from 'react';
import useStore from '../store/useStore';
import { LogIn, User, Lock } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const login = useStore((state) => state.login);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const result = await login(username, password);
        if (!result.success) {
            setError(result.error);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
                <div className="text-center mb-8">
                    <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
                        <span className="text-white text-2xl font-bold">RMS</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">نظام إدارة المطعم</h1>
                    <p className="text-slate-500 mt-2">يرجى تسجيل الدخول للمتابعة</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 italic">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">اسم المستخدم</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                                <User size={18} />
                            </span>
                            <input
                                type="text"
                                required
                                className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                                placeholder="أدخل اسم المستخدم"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                                <Lock size={18} />
                            </span>
                            <input
                                type="password"
                                required
                                className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                                placeholder="أدخل كلمة المرور"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'جاري التحميل...' : (
                            <>
                                <LogIn size={20} />
                                تسجيل الدخول
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
