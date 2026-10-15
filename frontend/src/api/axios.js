import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// -------------- 1. خدمة التوكنات (Token Service) --------------
export const setTokens = (access, refresh) => {
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
  // إطلاق حدث (Event) مخصص لتحديث واجهة المراقبة
  window.dispatchEvent(new Event('tokensChanged'));
};

export const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.dispatchEvent(new Event('tokensChanged'));
};

// -------------- 2. حقن الـ Access Token في كل طلب --------------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// -------------- 3. التجديد التلقائي عند انتهاء الـ 30 ثانية --------------
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/token/')) return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        clearTokens();
        // Do not redirect here, handle in UI/store based on isAuthenticated state
        return Promise.reject(error);
      }

      try {
        // طلب توكن جديد
        const { data } = await axios.post(`${api.defaults.baseURL}/token/refresh/`, { refresh: refreshToken });
        setTokens(data.access, data.refresh);

        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        processQueue(null, data.access);
        return api(originalRequest);
      } catch (err) {
        console.error('[Auth] Refresh failed:', err.response?.status || 'network');
        processQueue(err, null);
        // Only clear tokens if it's a definitive auth failure (401/403)
        // Network errors or 500s shouldn't log the user out
        if (err.response?.status === 401 || err.response?.status === 403) {
          clearTokens();
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// -------------- 4. تحديث التوكن التلقائي (كل 30 ثانية) إذا لم تكن هناك طلبات --------------
let consecutiveRefreshFailures = 0;

const attemptBackgroundRefresh = async () => {
  if (isRefreshing) return; // Skip if already refreshing via interceptor

  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return;

  try {
    isRefreshing = true;
    const { data } = await axios.post(`${api.defaults.baseURL}/token/refresh/`, { refresh });
    setTokens(data.access, data.refresh);
    consecutiveRefreshFailures = 0;
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      consecutiveRefreshFailures++;
      console.warn(`[Auth] Background refresh failed (${consecutiveRefreshFailures}/3)`);

      if (consecutiveRefreshFailures >= 3) {
        console.error('[Auth] Persistent refresh failed - clearing tokens and redirecting');
        clearTokens();
        consecutiveRefreshFailures = 0;
        // Force redirect to login to get new tokens
        window.location.href = '/login';
      } else {
        setTimeout(attemptBackgroundRefresh, 3000);
      }
    }
  } finally {
    isRefreshing = false;
  }
};

export const startTokenAutoRefresh = () => {
  // تشغيل أولي فوراً لضمان صلاحية التوكن عند البداية
  attemptBackgroundRefresh();

  // ثم كل 25 ثانية (أقل قليلاً من 30 ثانية للأمان)
  setInterval(attemptBackgroundRefresh, 25000);
};

export default api;
