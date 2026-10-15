import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { useThemeStore } from '../store/themeStore';
import {
    LayoutDashboard,
    UtensilsCrossed,
    Table2,
    ClipboardList,
    BarChart3,
    Users,
    Settings,
    LogOut,
    Bell,
    Search,
    Menu as MenuIcon,
    ShoppingBag,
    Truck,
    Package,
    Truck as SupplierIcon,
    BookOpen,
    Boxes,
    ChefHat,
    Star,
    Moon,
    Sun,
    PieChart,
    Activity,
    AlertTriangle,
    Trash2,
    ShieldCheck,
    FileText
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
    const { user, logout } = useStore();
    const { isDarkMode, toggleDarkMode } = useThemeStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const allNavItems = [
        { to: '/', icon: <LayoutDashboard size={20} />, label: 'لوحة التحكم', module: 'dashboard' },
        { to: '/loyalty', icon: <Star size={20} />, label: 'الولاء والعملاء', module: 'loyalty' },
        { to: '/orders', icon: <ClipboardList size={20} />, label: 'الطلبات', module: 'orders' },
        { to: '/kds', icon: <ChefHat size={20} />, label: 'شاشة المطبخ', module: 'kds' },
        { to: '/delivery', icon: <Truck size={20} />, label: 'متابعة الدليفري', module: 'delivery_monitor' },
        { to: '/agent', icon: <LayoutDashboard size={20} />, label: 'توصيل الطلبات', module: 'delivery_agent' },
        { to: '/pos', icon: <ShoppingBag size={20} />, label: 'نقطة البيع (POS)', module: 'pos' },
        { to: '/tables', icon: <Table2 size={20} />, label: 'الترابيزات', module: 'tables' },
        { to: '/menu', icon: <UtensilsCrossed size={20} />, label: 'المنيو', module: 'menu' },
        { to: '/reports', icon: <BarChart3 size={20} />, label: 'التقارير', module: 'reports' },
        { to: '/staff', icon: <Users size={20} />, label: 'الموظفين', module: 'staff' },
        // Inventory Group
        { to: '/ingredients', icon: <Package size={20} />, label: 'المكونات والمخزون', module: 'ingredients' },
        { to: '/suppliers', icon: <SupplierIcon size={20} />, label: 'الموردين', module: 'suppliers' },
        { to: '/recipes', icon: <BookOpen size={20} />, label: 'الوصفات والتكاليف', module: 'recipes' },
        { to: '/inventory', icon: <Boxes size={20} />, label: 'حركات المخزن', module: 'inventory_movements' },
        { to: '/low-stock', icon: <AlertTriangle size={20} />, label: 'الرصيد الحرج', module: 'low_stock' },
        { to: '/waste-management', icon: <Trash2 size={20} />, label: 'إدارة الهادر', module: 'waste_management' },
        // Analytics
        { to: '/menu-analytics', icon: <PieChart size={20} />, label: 'تحليل المنيو (ABC)', module: 'menu_analytics' },
        { to: '/staff-performance', icon: <Activity size={20} />, label: 'أداء الموظفين', module: 'staff_performance' },
        // Security (Owner only)
        { to: '/audit-log', icon: <FileText size={20} />, label: 'سجل المراجعة', module: 'audit_log' },
        { to: '/permissions', icon: <ShieldCheck size={20} />, label: 'مصفوفة الصلاحيات', module: 'permissions_matrix' },
    ];


    const navItems = allNavItems.filter(item => {
        if (user?.role === 'owner') return true;
        return user?.permissions?.[item.module];
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* Sidebar */}
            <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20`}>
                <div className="p-6 flex items-center gap-3">
                    <div className="bg-orange-500 min-w-[40px] h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-md">
                        RMS
                    </div>
                    {isSidebarOpen && <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">مطعمنا</span>}
                </div>

                <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto scrollbar-hide">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `
                                flex items-center gap-3 px-3 py-3 rounded-xl transition-all
                                ${isActive ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}
                            `}
                        >
                            {item.icon}
                            {isSidebarOpen && <span className="text-sm">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-3 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span>تسجيل الخروج</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-10 transition-colors duration-300">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                        <MenuIcon size={24} />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="بحث عن طلب أو صنف..."
                                className="bg-slate-100 dark:bg-slate-800 border-none rounded-full pr-10 pl-4 py-2 text-sm w-64 focus:ring-2 focus:ring-orange-500/20 outline-none dark:text-slate-200"
                            />
                        </div>

                        <button
                            onClick={toggleDarkMode}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                        </button>

                        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800">

                            <Bell size={22} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white"></span>
                        </button>

                        <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-800">
                            <div className="text-left hidden sm:block text-right">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.first_name || user?.username}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role_display}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border-2 border-white dark:border-slate-800 shadow-sm">
                                {user?.username?.substring(0, 1).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
