import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: `${API_BASE_URL}/api/public`,
});

const scopedPath = (restaurantSlug, path) => {
    if (!restaurantSlug) throw new Error('A restaurant slug is required.');
    return `/${encodeURIComponent(restaurantSlug)}${path}`;
};

export const publicApi = {
    getMenu: (restaurantSlug) => api.get(scopedPath(restaurantSlug, '/menu/')),
    createOrder: (restaurantSlug, orderData) => api.post(scopedPath(restaurantSlug, '/orders/'), orderData),
    trackOrder: (restaurantSlug, orderNumber, phone) =>
        api.get(scopedPath(restaurantSlug, `/track/${orderNumber}/`), { params: { phone } }),

    // QR Ordering Endpoints
    getTableFromQR: (code) => axios.get(`${API_BASE_URL}/api/tables/from-qr/${code}/`),
    createSession: (tableId, restaurantSlug) => axios.post(`${API_BASE_URL}/api/tables/sessions/create_session/`, { table_id: tableId, restaurant_slug: restaurantSlug }),
    submitCustomerOrder: (restaurantSlug, orderData) => axios.post(
        `${API_BASE_URL}/api/orders/customer_order/`,
        { ...orderData, restaurant_slug: restaurantSlug }
    ),

    // Loyalty Endpoints
    getActiveCampaign: (restaurantSlug) => api.get(scopedPath(restaurantSlug, '/loyalty/campaigns/active/')),
    getCustomerInfo: (restaurantSlug, phone) => api.post(scopedPath(restaurantSlug, '/loyalty/customer-info/'), { phone }),

    // Offer & Coupon Endpoints
    getOffers: (restaurantSlug) => api.get(scopedPath(restaurantSlug, '/offers/')),
    applyCoupon: (restaurantSlug, code, subtotal) => api.post(scopedPath(restaurantSlug, '/apply-coupon/'), { code, subtotal }),
};
