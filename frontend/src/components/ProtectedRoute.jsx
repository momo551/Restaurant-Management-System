import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../store/useStore';

export default function ProtectedRoute({ children, allowedRoles, module }) {
    const { user, isAuthenticated, loading } = useStore();
    const location = useLocation();

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        </div>
    );

    if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

    // Owner always has access
    if (user?.role === 'owner') return children;

    // Check dynamic module permission if provided
    const hasModulePermission = module ? user?.permissions?.[module] : false;
    
    // Check role permission if provided
    const hasRolePermission = allowedRoles ? allowedRoles.includes(user?.role) : false;

    // Grant access if either permission matches
    if (hasModulePermission || hasRolePermission) {
        return children;
    }

    // Specific landing pages for roles if they try to access root and are unauthorized
    if (location.pathname === '/') {
        if (user?.role === 'kitchen') return <Navigate to="/orders" replace />;
        if (user?.role === 'delivery') return <Navigate to="/agent" replace />;
        if (user?.role === 'inventory_manager') return <Navigate to="/ingredients" replace />;
        if (user?.role === 'hr') return <Navigate to="/staff" replace />;
        if (user?.role === 'cashier' || user?.role === 'hall_manager' || user?.role === 'hall_captain') return <Navigate to="/pos" replace />;
    }

    // Use the dedicated unauthorized page for other restricted access
    return <Navigate to="/unauthorized" replace />;
}

