import { useState, useEffect } from 'react';
import api from '../api/axios';
import useStore from '../store/useStore';
import {
    Users as UsersIcon,
    UserPlus,
    Search,
    Mail,
    Phone,
    Shield,
    MoreVertical,
    Calendar,
    CheckCircle2,
    XCircle,
    FileBarChart,
    Target,
    DollarSign,
    ShoppingBag as OrdersIcon,
    X,
    ArrowUpRight,
    TrendingUp
} from 'lucide-react';

export default function StaffManagement() {
    const { user: currentUser } = useStore();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [newTarget, setNewTarget] = useState('');
    const [loadingReport, setLoadingReport] = useState(false);
    const [resetPasswordData, setResetPasswordData] = useState({ password: '', password_confirm: '' });
    const [editEmployeeData, setEditEmployeeData] = useState({
        username: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        email: '',
        role: '',
        phone: '',
        base_salary: 0,
        is_active: true
    });
    const [newEmployee, setNewEmployee] = useState({
        username: '',
        password: '',
        password_confirm: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'cashier',
        phone: '',
        monthly_target: 0,
        base_salary: 0,
        delivery_commission_rate: 0
    });

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const res = await api.get('/users/staff_stats/');
            setStaff(res.data);
        } catch (err) {
            console.error('Error fetching staff', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaffReport = async (userId) => {
        try {
            setLoadingReport(true);
            setIsReportModalOpen(true);
            const res = await api.get(`/users/${userId}/staff_report/`);
            setReportData(res.data);
        } catch (err) {
            console.error('Error fetching staff report', err);
            alert('حدث خطأ أثناء تحميل التقرير');
            setIsReportModalOpen(false);
        } finally {
            setLoadingReport(false);
        }
    };

    const updateTarget = async () => {
        try {
            await api.patch(`/users/${selectedStaff.id}/`, {
                monthly_target: parseFloat(newTarget)
            });
            setIsTargetModalOpen(false);
            fetchStaff();
        } catch (err) {
            console.error('Error updating target', err);
            alert('حدث خطأ أثناء تحديث المستهدف');
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users/', newEmployee);
            setIsAddModalOpen(false);
            setNewEmployee({
                username: '', password: '', password_confirm: '',
                first_name: '', last_name: '', email: '', role: 'cashier',
                phone: '', monthly_target: 0, base_salary: 0, delivery_commission_rate: 0
            });
            fetchStaff();
        } catch (err) {
            console.error('Error adding employee', err);
            const msg = err.response?.data ? JSON.stringify(err.response.data) : 'حدث خطأ أثناء إضافة الموظف';
            alert(msg);
        }
    };

    const handleUpdateEmployee = async (e) => {
        e.preventDefault();
        try {
            await api.patch(`/users/${selectedStaff.id}/`, editEmployeeData);
            setIsEditModalOpen(false);
            fetchStaff();
        } catch (err) {
            console.error('Error updating employee', err);
            alert('حدث خطأ أثناء تحديث بيانات الموظف');
        }
    };

    const handleDeleteEmployee = async (userId) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
        try {
            await api.delete(`/users/${userId}/`);
            fetchStaff();
        } catch (err) {
            console.error('Error deleting employee', err);
            alert('حدث خطأ أثناء حذف الموظف');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/users/${selectedStaff.id}/force_reset_password/`, resetPasswordData);
            setIsResetPasswordModalOpen(false);
            setResetPasswordData({ password: '', password_confirm: '' });
            alert('تم تغيير كلمة المرور بنجاح');
        } catch (err) {
            console.error('Error resetting password', err);
            const msg = err.response?.data?.error || 'حدث خطأ أثناء إعادة تعيين كلمة المرور';
            alert(msg);
        }
    };

    const filteredStaff = staff.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role_display?.toLowerCase().includes(searchQuery.toLowerCase())
    );


    const present_count = staff.filter(s => {
        if (!s.last_activity) return false;
        const lastActivityDate = new Date(s.last_activity);
        const diffInMinutes = (new Date() - lastActivityDate) / (1000 * 60);
        return diffInMinutes < 15; // Active in the last 15 minutes
    }).length;

    const roles_count = new Set(staff.map(s => s.role)).size;

    if (loading) return <div>جاري التحميل...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">إدارة الموظفين 🧑‍🍳</h1>
                    <p className="text-slate-500">متابعة أداء الموظفين والأدوار والصلاحيات.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-orange-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all font-medium"
                >
                    <UserPlus size={18} />
                    إضافة موظف
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <UsersIcon size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">إجمالي الموظفين</p>
                        <p className="text-2xl font-bold text-slate-800">{staff.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">متواجدون الآن</p>
                        <p className="text-2xl font-bold text-slate-800">{present_count}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-bold">أدوار الصلاحيات</p>
                        <p className="text-2xl font-bold text-slate-800">{roles_count}</p>
                    </div>
                </div>
            </div>

            {/* Search & List */}
            <div className="bg-white rounded-2xl border border-slate-100">
                <div className="p-4 border-b border-slate-50">
                    <div className="relative max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="البحث بالاسم أو الدور..."
                            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">الموظف</th>
                            <th className="px-6 py-4">الدور</th>
                            <th className="px-6 py-4 text-center">الراتب</th>
                            <th className="px-6 py-4 text-center">المستهدف</th>
                            <th className="px-6 py-4 text-center">إجمالي العمولة</th>
                            <th className="px-6 py-4">الحالة</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredStaff.map((person, i) => (
                            <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                            {person.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{person.name}</p>
                                            <p className="text-xs text-orange-500 font-medium">@{person.username}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                        {person.role_display}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-slate-700">{person.base_salary || 0}</span>
                                            <span className="text-[10px] text-slate-400">ج.م</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedStaff(person);
                                                setNewTarget(person.monthly_target);
                                                setIsTargetModalOpen(true);
                                            }}
                                            className="text-[10px] text-orange-500 hover:underline"
                                        >
                                            تعديل
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-slate-700">{person.monthly_target || 0}</span>
                                            <span className="text-[10px] text-slate-400">ج.م</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center">
                                        <span className="font-bold text-green-600">{Number(person.total_commissions || 0).toFixed(2)}</span>
                                        <span className="text-[10px] text-slate-400">ج.م</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button
                                            onClick={() => fetchStaffReport(person.id)}
                                            className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all flex items-center gap-1 text-xs"
                                            title="عرض التقرير"
                                        >
                                            <FileBarChart size={18} />
                                            <span>التقرير</span>
                                        </button>
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveMenuId(activeMenuId === person.id ? null : person.id)}
                                                className="text-slate-300 hover:text-slate-600 p-2"
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            
                                            {activeMenuId === person.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveMenuId(null)}></div>
                                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden min-w-[14rem] origin-top-right animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStaff(person);
                                                                setEditEmployeeData({
                                                                    username: person.username || '',
                                                                    password: '',
                                                                    password_confirm: '',
                                                                    first_name: person.first_name || person.name.split(' ')[0] || '',
                                                                    last_name: person.last_name || person.name.split(' ').slice(1).join(' ') || '',
                                                                    email: person.email || '',
                                                                    role: person.role,
                                                                    phone: person.phone || '',
                                                                    base_salary: person.base_salary || 0,
                                                                    is_active: person.is_active !== false
                                                                });
                                                                setIsEditModalOpen(true);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-50"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <UserPlus size={16} className="text-blue-500" />
                                                                <span>تعديل البيانات</span>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedStaff(person);
                                                                setIsResetPasswordModalOpen(true);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full text-right px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 border-b border-slate-50"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Shield size={16} className="text-orange-500" />
                                                                <span>تغيير كلمة المرور</span>
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleDeleteEmployee(person.id);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full text-right px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center justify-between gap-2"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <X size={16} />
                                                                <span>حذف الموظف</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Employee Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in duration-200 custom-scrollbar">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-slate-800">إضافة موظف جديد</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddEmployee} className="p-6 space-y-4 text-right" dir="rtl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">اسم المستخدم (للدخول)</label>
                                    <input required type="text" value={newEmployee.username} onChange={e => setNewEmployee({ ...newEmployee, username: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الدور الوظيفي</label>
                                    <select required value={newEmployee.role} onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none">
                                        <option value="owner">مالك المطعم</option>
                                        <option value="manager">مدير</option>
                                        <option value="inventory_manager">مدير مخازن</option>
                                        <option value="hall_manager">مدير صاله</option>
                                        <option value="hall_captain">كابتن صاله</option>
                                        <option value="cashier">كاشير</option>
                                        <option value="kitchen">مطبخ</option>
                                        <option value="delivery">طيار / مندوب</option>
                                        <option value="hr">موارد بشرية</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الأول</label>
                                    <input required type="text" value={newEmployee.first_name} onChange={e => setNewEmployee({ ...newEmployee, first_name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الأخير</label>
                                    <input required type="text" value={newEmployee.last_name} onChange={e => setNewEmployee({ ...newEmployee, last_name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور</label>
                                    <input required type="password" value={newEmployee.password} onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور</label>
                                    <input required type="password" value={newEmployee.password_confirm} onChange={e => setNewEmployee({ ...newEmployee, password_confirm: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
                                    <input type="email" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none text-left" dir="ltr" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
                                    <input type="text" value={newEmployee.phone} onChange={e => setNewEmployee({ ...newEmployee, phone: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الراتب الأساسي</label>
                                    <input type="number" value={newEmployee.base_salary} onChange={e => setNewEmployee({ ...newEmployee, base_salary: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">المستهدف الشهري (اختياري)</label>
                                    <input type="number" value={newEmployee.monthly_target} onChange={e => setNewEmployee({ ...newEmployee, monthly_target: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                {newEmployee.role === 'delivery' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">عمولة التوصيل للطّلب</label>
                                        <input type="number" value={newEmployee.delivery_commission_rate} onChange={e => setNewEmployee({ ...newEmployee, delivery_commission_rate: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="w-full mt-6 bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100">
                                إضافة الموظف
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Target & Commission Modal */}
            {isTargetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">تعديل المعلومات المالية</h2>
                            <button onClick={() => setIsTargetModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">الراتب الأساسي: {selectedStaff?.name}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={selectedStaff?.base_salary || 0}
                                        onChange={(e) => setSelectedStaff({ ...selectedStaff, base_salary: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none text-lg font-bold"
                                        placeholder="مثلاً: 3000"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">المستهدف الشهري</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={newTarget}
                                        onChange={(e) => setNewTarget(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none text-lg font-bold"
                                        placeholder="مثلاً: 5000"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                                </div>
                            </div>

                            {selectedStaff?.role === 'طيار / مندوب' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">عمولة التوصيل للطلب الواحد</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={selectedStaff?.delivery_commission_rate || 0}
                                            onChange={(e) => setSelectedStaff({ ...selectedStaff, delivery_commission_rate: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none text-lg font-bold"
                                            placeholder="مثلاً: 10"
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">ج.م</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={async () => {
                                    try {
                                        const updateData = {
                                            monthly_target: parseFloat(newTarget),
                                            base_salary: parseFloat(selectedStaff.base_salary)
                                        };
                                        if (selectedStaff?.role === 'طيار / مندوب') {
                                            updateData.delivery_commission_rate = parseFloat(selectedStaff.delivery_commission_rate);
                                        }
                                        await api.patch(`/users/${selectedStaff.id}/`, updateData);
                                        setIsTargetModalOpen(false);
                                        fetchStaff();
                                    } catch (err) {
                                        alert('حدث خطأ أثناء التحديث');
                                    }
                                }}
                                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100"
                            >
                                حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-50 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">تقرير أداء الموظف</h2>
                                <p className="text-sm text-slate-500">{reportData?.user?.first_name || reportData?.user?.username}</p>
                            </div>
                            <button onClick={() => { setIsReportModalOpen(false); setReportData(null); }} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {loadingReport ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-slate-500 font-medium">جاري تحضير التقرير...</p>
                                </div>
                            ) : reportData && (
                                <>
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><DollarSign size={20} /></div>
                                                <span className="text-sm font-medium text-slate-500">مبيعات الشهر</span>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-800">{reportData.stats.monthly_sales.toFixed(2)} <span className="text-sm font-normal text-slate-400">ج.م</span></p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Target size={20} /></div>
                                                <span className="text-sm font-medium text-slate-500">المستهدف الشهري</span>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-800">{reportData.stats.monthly_target || 0} <span className="text-sm font-normal text-slate-400">ج.م</span></p>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><DollarSign size={20} /></div>
                                                <span className="text-sm font-medium text-slate-500">إجمالي العمولة</span>
                                            </div>
                                            <p className="text-2xl font-bold text-slate-800">{(Number(reportData.user.total_commissions) || 0).toFixed(2)} <span className="text-sm font-normal text-slate-400">ج.م</span></p>
                                        </div>
                                    </div>

                                    {/* Orders Table */}
                                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <OrdersIcon size={18} className="text-slate-400" />
                                                سجل الطلبات
                                            </h3>
                                            <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                                                إجمالي {reportData.stats.total_orders} طلب
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-right">
                                                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">رقم الطلب</th>
                                                        <th className="px-4 py-3">التاريخ</th>
                                                        <th className="px-4 py-3">الأصناف</th>
                                                        <th className="px-4 py-3">الإجمالي</th>
                                                        <th className="px-4 py-3">الحالة</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {reportData.orders.map((order) => (
                                                        <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-slate-700 text-sm">
                                                                <div className="flex flex-col">
                                                                    <span className="text-orange-500">#{order.daily_id}</span>
                                                                    <span className="text-[10px] text-slate-400">{order.order_number.split('-').pop()}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                                {new Date(order.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {order.items.map((item, idx) => (
                                                                        <span key={idx} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                                            {item.quantity}x {item.menu_item_details.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-orange-600 text-sm">{order.total} ج.م</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.status === 'paid' ? 'bg-green-50 text-green-600' :
                                                                    order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                                                                        'bg-blue-50 text-blue-600'
                                                                    }`}>
                                                                    {order.status_display}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Employee Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">تعديل بيانات الموظف</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4 text-right" dir="rtl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الأول</label>
                                    <input required type="text" value={editEmployeeData.first_name} onChange={e => setEditEmployeeData({ ...editEmployeeData, first_name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الأخير</label>
                                    <input required type="text" value={editEmployeeData.last_name} onChange={e => setEditEmployeeData({ ...editEmployeeData, last_name: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                
                                <div className="md:col-span-2 border-t border-slate-50 pt-4 mt-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم (للدخول بالنظام)</label>
                                    <input 
                                        required 
                                        type="text" 
                                        value={editEmployeeData.username} 
                                        onChange={e => setEditEmployeeData({ ...editEmployeeData, username: e.target.value })} 
                                        className={`w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none text-lg font-bold ${currentUser?.role !== 'owner' ? 'bg-slate-50 text-slate-400' : 'bg-white text-orange-600'}`} 
                                        disabled={currentUser?.role !== 'owner'}
                                        placeholder="اسم الدخول"
                                    />
                                    {currentUser?.role === 'owner' && (
                                        <p className="text-[10px] text-slate-400 mt-1">هذا هو الاسم الذي يستخدمه الموظف لتسجيل الدخول.</p>
                                    )}
                                </div>

                                {currentUser?.role === 'owner' && (
                                    <>
                                        <div className="md:col-span-2 border-t border-slate-50 pt-4">
                                            <p className="text-xs font-bold text-slate-400 mb-2">تحديث الأمان (اختياري)</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">كلمة مرور جديدة</label>
                                            <input 
                                                type="password" 
                                                value={editEmployeeData.password} 
                                                onChange={e => setEditEmployeeData({ ...editEmployeeData, password: e.target.value })} 
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" 
                                                placeholder="الحفاظ على الحالية"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور</label>
                                            <input 
                                                type="password" 
                                                value={editEmployeeData.password_confirm} 
                                                onChange={e => setEditEmployeeData({ ...editEmployeeData, password_confirm: e.target.value })} 
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="md:col-span-2 border-t border-slate-50 pt-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الدور الوظيفي</label>
                                    <select required value={editEmployeeData.role} onChange={e => setEditEmployeeData({ ...editEmployeeData, role: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none">
                                        <option value="owner">مالك المطعم</option>
                                        <option value="manager">مدير</option>
                                        <option value="inventory_manager">مدير مخازن</option>
                                        <option value="hall_manager">مدير صاله</option>
                                        <option value="hall_captain">كابتن صاله</option>
                                        <option value="cashier">كاشير</option>
                                        <option value="kitchen">مطبخ</option>
                                        <option value="delivery">طيار / مندوب</option>
                                        <option value="hr">موارد بشرية</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
                                    <input type="text" value={editEmployeeData.phone} onChange={e => setEditEmployeeData({ ...editEmployeeData, phone: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">الراتب الأساسي</label>
                                    <input type="number" value={editEmployeeData.base_salary} onChange={e => setEditEmployeeData({ ...editEmployeeData, base_salary: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 py-4 border-t border-slate-50">
                                <input 
                                    type="checkbox" 
                                    id="is_active_edit" 
                                    checked={editEmployeeData.is_active} 
                                    onChange={e => setEditEmployeeData({ ...editEmployeeData, is_active: e.target.checked })}
                                    className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                />
                                <label htmlFor="is_active_edit" className="text-base font-bold text-slate-700">موظف نشط</label>
                            </div>
                            
                            <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 text-lg">
                                حفظ التغييرات
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {isResetPasswordModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">تغيير كلمة المرور</h2>
                            <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-6 space-y-4 text-right" dir="rtl">
                            <p className="text-sm text-slate-500 mb-4">تغيير كلمة المرور للموظف: <span className="font-bold text-slate-800">{selectedStaff?.name}</span></p>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">كلمة المرور الجديدة</label>
                                <input required type="password" value={resetPasswordData.password} onChange={e => setResetPasswordData({ ...resetPasswordData, password: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">تأكيد كلمة المرور</label>
                                <input required type="password" value={resetPasswordData.password_confirm} onChange={e => setResetPasswordData({ ...resetPasswordData, password_confirm: e.target.value })} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 outline-none" />
                            </div>
                            <button type="submit" className="w-full mt-6 bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-100">
                                تحديث كلمة المرور
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
