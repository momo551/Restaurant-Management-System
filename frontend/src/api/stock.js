import api from './axios';

const stockApi = {
    // Ingredients
    getIngredients: (params) => api.get('/stock/ingredients/', { params }),
    createIngredient: (data) => api.post('/stock/ingredients/', data),
    updateIngredient: (id, data) => api.patch(`/stock/ingredients/${id}/`, data),
    deleteIngredient: (id) => api.delete(`/stock/ingredients/${id}/`),
    adjustStock: (id, data) => api.post(`/stock/ingredients/${id}/adjust_stock/`, data),
    exportPdf: () => api.get('/stock/ingredients/export_pdf/', { responseType: 'blob' }),

    // Suppliers
    getSuppliers: () => api.get('/stock/suppliers/'),
    createSupplier: (data) => api.post('/stock/suppliers/', data),
    updateSupplier: (id, data) => api.patch(`/stock/suppliers/${id}/`, data),
    deleteSupplier: (id) => api.delete(`/stock/suppliers/${id}/`),

    // Recipes
    getRecipes: () => api.get('/stock/recipes/'),
    getGroupedRecipes: () => api.get('/stock/recipes/grouped_by_menu_item/'),
    createRecipe: (data) => api.post('/stock/recipes/', data),
    updateRecipe: (id, data) => api.patch(`/stock/recipes/${id}/`, data),
    updateRecipeBulk: (data) => api.post('/stock/recipes/update_recipe/', data),
    deleteRecipe: (id) => api.delete(`/stock/recipes/${id}/`),

    // Purchase Orders
    getPurchaseOrders: () => api.get('/stock/purchase-orders/'),
    createPurchaseOrder: (data) => api.post('/stock/purchase-orders/', data),
    updatePurchaseOrder: (id, data) => api.patch(`/stock/purchase-orders/${id}/`, data),
    deletePurchaseOrder: (id) => api.delete(`/stock/purchase-orders/${id}/`),
    getPurchaseOrder: (id) => api.get(`/stock/purchase-orders/${id}/`),
    changePOStatus: (id, status) => api.post(`/stock/purchase-orders/${id}/change_status/`, { status }),

    // Movements (Transactions)
    getMovements: (params) => api.get('/stock/movements/', { params }),
};

export default stockApi;
