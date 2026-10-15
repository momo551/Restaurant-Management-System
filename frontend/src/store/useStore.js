import { create } from 'zustand';
import api, { setTokens, clearTokens } from '../api/axios';

const useStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  checkAuth: async () => {
    try {
      const res = await api.get('/users/me/');
      set({ user: res.data, isAuthenticated: true, loading: false });
    } catch (err) {
      set({ user: null, isAuthenticated: false, loading: false });
      clearTokens();
    }
  },

  login: async (username, password) => {
    try {
      const { data } = await api.post('/token/', { username, password });
      setTokens(data.access, data.refresh);
      await get().checkAuth();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'فشل تسجيل الدخول' };
    }
  },

  logout: async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await api.post('/logout/', { refresh });
      }
    } catch (err) {
      console.warn('Logout request failed, clearing local state anyway');
    }
    clearTokens();
    set({ user: null, isAuthenticated: false });
  },
}));

export default useStore;
