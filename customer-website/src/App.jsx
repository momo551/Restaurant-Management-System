import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import TrackingPage from './pages/TrackingPage';
import QRRedirect from './pages/QRRedirect';
import UserDashboardPage from './pages/UserDashboardPage';
import { useThemeStore } from './store/themeStore';
import { RestaurantLayout } from './restaurantContext';

function App() {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 transition-colors duration-200">
        <main className="pb-12">
          <Routes>
            <Route path="/scan/:code" element={<QRRedirect />} />
            <Route path="/customer/:restaurantSlug" element={<RestaurantLayout />}>
              <Route index element={<HomePage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="track" element={<TrackingPage />} />
              <Route path="loyalty" element={<UserDashboardPage />} />
            </Route>
            <Route path="*" element={<div className="min-h-screen flex items-center justify-center p-6 text-center text-gray-600">رابط المطعم غير صالح أو غير مكتمل.</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
