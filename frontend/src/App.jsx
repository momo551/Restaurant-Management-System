import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { startTokenAutoRefresh } from './api/axios';
import useStore from './store/useStore';
import { useThemeStore } from './store/themeStore';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import TablesLayout from './pages/TablesLayout';
import MenuAnalytics from './pages/MenuAnalytics';
import StaffPerformance from './pages/StaffPerformance';
import OrderTaking from './pages/OrderTaking';
import OrderList from './pages/OrderList';
import StaffManagement from './pages/StaffManagement';
import Reports from './pages/Reports';
import DeliveryTracking from './pages/DeliveryTracking';
import DeliveryAgentDashboard from './pages/DeliveryAgentDashboard';
import KDSPage from './pages/KDSPage';
import LoyaltyDashboard from './pages/LoyaltyDashboard';
import IngredientsPage from './pages/IngredientsPage';
import SuppliersPage from './pages/SuppliersPage';
import RecipesPage from './pages/RecipesPage';
import StockMovementsPage from './pages/StockMovementsPage';
import LowStockAlerts from './pages/LowStockAlerts';
import WasteManagement from './pages/WasteManagement';
import AuditLog from './pages/AuditLog';
import PermissionsMatrix from './pages/PermissionsMatrix';
import QRRedirect from './pages/QRRedirect';
import Unauthorized from './pages/Unauthorized';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    const { checkAuth, isAuthenticated, loading } = useStore();
    const { isDarkMode } = useThemeStore();

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    useEffect(() => {
        checkAuth();
        startTokenAutoRefresh();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    return (
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/order/:code" element={<QRRedirect />} />
                <Route path="/scan/:code" element={<QRRedirect />} />

                {/* System Settings */}
                <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager', 'hall_manager']} module="dashboard">
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/menu"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager']} module="menu">
                                <MenuManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/loyalty"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager']} module="loyalty">
                                <LoyaltyDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/tables"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'hall_manager', 'hall_captain']} module="tables">
                                <TablesLayout />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'kitchen', 'hall_manager', 'hall_captain']} module="orders">
                                <OrderList />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/kds"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'kitchen']} module="kds">
                                <KDSPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/pos"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'cashier', 'hall_manager', 'hall_captain']} module="pos">
                                <OrderTaking />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/delivery"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager', 'hall_manager']} module="delivery_monitor">
                                <DeliveryTracking />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/staff"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'hr']} module="staff">
                                <StaffManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/reports"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager', 'hall_manager', 'hr']} module="reports">
                                <Reports />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/agent"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'delivery']} module="delivery_agent">
                                <DeliveryAgentDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/ingredients"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="ingredients">
                                <IngredientsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/suppliers"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="suppliers">
                                <SuppliersPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/recipes"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="recipes">
                                <RecipesPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/inventory"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="inventory_movements">
                                <StockMovementsPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/low-stock"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="low_stock">
                                <LowStockAlerts />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/waste-management"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'inventory_manager']} module="waste_management">
                                <WasteManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/menu-analytics"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager']} module="menu_analytics">
                                <MenuAnalytics />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/staff-performance"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'manager', 'hr']} module="staff_performance">
                                <StaffPerformance />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/audit-log"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'hr']} module="audit_log">
                                <AuditLog />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/permissions"
                        element={
                            <ProtectedRoute allowedRoles={['owner', 'hr']} module="permissions_matrix">
                                <PermissionsMatrix />
                            </ProtectedRoute>
                        }
                    />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;
