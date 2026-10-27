import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise = null;
let sessionGeneration = 0;
let refreshPromiseGeneration = null;

export const getSessionGeneration = () => sessionGeneration;

export const bumpSessionGeneration = () => {
  sessionGeneration++;
  return sessionGeneration;
};

export const clearRefreshPromise = () => {
  bumpSessionGeneration();
  refreshPromise = null;
  refreshPromiseGeneration = null;
};

// Stamp _sessionGeneration at request invocation/creation time so that requests
// delayed before or between interceptors retain their originating session.
const stampSession = (config) => {
  const cfg = config || {};
  if (cfg._sessionGeneration === undefined) {
    cfg._sessionGeneration = sessionGeneration;
  }
  return cfg;
};

const wrapMethod2 = (fn) => function(url, config) {
  return fn.call(this, url, stampSession(config));
};

const wrapMethod3 = (fn) => function(url, data, config) {
  return fn.call(this, url, data, stampSession(config));
};

api.get = wrapMethod2(api.get);
api.delete = wrapMethod2(api.delete);
api.head = wrapMethod2(api.head);
api.options = wrapMethod2(api.options);
api.post = wrapMethod3(api.post);
api.put = wrapMethod3(api.put);
api.patch = wrapMethod3(api.patch);

const origRequest = api.request;
api.request = function(configOrUrl, config) {
  if (typeof configOrUrl === 'string') {
    return origRequest.call(this, configOrUrl, stampSession(config));
  }
  return origRequest.call(this, stampSession(configOrUrl), config);
};

// -------------- 1. خدمة التوكنات (Token Service) --------------
export const setTokens = (access, refresh) => {
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
  // إطلاق حدث (Event) مخصص لتحديث واجهة المراقبة
  window.dispatchEvent(new Event('tokensChanged'));
};

export const clearTokens = (generation) => {
  if (generation !== undefined && generation !== sessionGeneration) {
    return;
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.dispatchEvent(new Event('tokensChanged'));
};

// -------------- 2. حقن الـ Access Token في كل طلب --------------
api.interceptors.request.use((config) => {
  // Reject stale requests whose session generation differs from the active session.
  // This prevents requests queued or delayed before this interceptor from sending
  // stale data or using a newer session's access token.
  if (
    config._sessionGeneration !== undefined &&
    config._sessionGeneration !== sessionGeneration
  ) {
    const cancelError = new axios.CanceledError(
      `Request aborted: session generation mismatch (${config._sessionGeneration} !== ${sessionGeneration})`
    );
    cancelError.config = config;
    cancelError.isSessionMismatch = true;
    return Promise.reject(cancelError);
  }

  if (config._sessionGeneration === undefined) {
    config._sessionGeneration = sessionGeneration;
  }

  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// -------------- 3. تجديد التوكن: طلب واحد مشترك (single-flight) --------------
//
// A single in-flight refresh promise is shared by the response interceptor and by
// the background refresher. Every caller awaits that same promise, so:
//   * concurrent 401s never start more than one refresh/rotation;
//   * no request can stay queued forever (there is no queue to leak);
//   * the "refreshing" state is owned by the promise itself and is always reset,
//     so a missing refresh token can no longer leave a permanent flag.
const NO_REFRESH_TOKEN = 'NO_REFRESH_TOKEN';

const getAccessToken = () => localStorage.getItem('access_token');
const getRefreshToken = () => localStorage.getItem('refresh_token');

const isAuthEndpoint = (config) => {
  const url = String(config?.url || '');
  // Login (api.post('/token/')) and the refresh endpoint must never be retried
  // through this interceptor: a 401 there is a real authentication failure.
  return url.includes('/token/');
};

const isDefinitiveAuthFailure = (error) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

const requestTokenRefresh = async (refreshTokenArg, generationArg) => {
  try {
    if (!refreshTokenArg) {
      const error = new Error(NO_REFRESH_TOKEN);
      error.code = NO_REFRESH_TOKEN;
      error.generation = generationArg;
      throw error;
    }

    const { data } = await axios.post(
      `${api.defaults.baseURL}/token/refresh/`,
      { refresh: refreshTokenArg }
    );

    // A logout (clearTokens) or another writer may have ended/replaced the session
    // while this request was in flight. Never re-create tokens for a session that
    // was explicitly ended locally; the caller treats this as "no session".
    if (getRefreshToken() !== refreshTokenArg) {
      const error = new Error(NO_REFRESH_TOKEN);
      error.code = NO_REFRESH_TOKEN;
      error.generation = generationArg;
      throw error;
    }

    // Check session generation to prevent old refresh from saving tokens after logout/login
    if (generationArg !== sessionGeneration) {
      const error = new Error(NO_REFRESH_TOKEN);
      error.code = NO_REFRESH_TOKEN;
      error.generation = generationArg;
      throw error;
    }

    setTokens(data.access, data.refresh);
    return data.access;
  } catch (error) {
    // Identify which session this failure belongs to, so callers never attribute
    // an old refresh failure to a newer session (nor clear its tokens).
    error.refreshToken = refreshTokenArg;
    error.generation = generationArg;
    throw error;
  }
};

const refreshAccessToken = () => {
  const currentRefreshToken = getRefreshToken();

  // If the shared promise belongs to an old session generation, detach it and start fresh
  if (refreshPromise && refreshPromiseGeneration !== sessionGeneration) {
    refreshPromise = null;
    refreshPromiseGeneration = null;
  }

  if (!refreshPromise) {
    refreshPromiseGeneration = sessionGeneration;

    const myPromise = requestTokenRefresh(currentRefreshToken, refreshPromiseGeneration)
      .catch((error) => {
        // Never log token values: only the failure shape. A missing refresh token
        // is an expected "not logged in" state, not a refresh failure.
        if (error?.code !== NO_REFRESH_TOKEN) {
          console.warn(
            '[Auth] Token refresh failed:',
            error?.response?.status || 'network'
          );
        }
        throw error;
      })
      .finally(() => {
        // Only clear the shared promise if this is still the current operation
        // and the session generation hasn't changed. This prevents an old
        // operation's finally from clearing a newer session's promise.
        if (refreshPromise === myPromise && refreshPromiseGeneration === sessionGeneration) {
          refreshPromise = null;
          refreshPromiseGeneration = null;
        }
      });

    refreshPromise = myPromise;
  }
  return refreshPromise;
};

const applyAccessToken = (config, accessToken) => {
  if (!config.headers) config.headers = {};
  config.headers['Authorization'] = `Bearer ${accessToken}`;
};

// A request that failed with an old access token may already be behind a refresh
// performed for another request; retry it with the current token instead of
// starting yet another rotation.
const wasSentWithOlderAccessToken = (config) => {
  const currentAccessToken = getAccessToken();
  if (!currentAccessToken) return false;

  const headers = config?.headers;
  const sentAuthorization =
    headers?.Authorization ||
    headers?.authorization ||
    (typeof headers?.get === 'function' ? headers.get('Authorization') : null);

  return sentAuthorization !== `Bearer ${currentAccessToken}`;
};

// -------------- 4. إعادة المحاولة عند HTTP 401 --------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isAuthEndpoint(originalRequest)) {
      return Promise.reject(error);
    }

    // A request sent from a previous session generation must NEVER be retried
    // under a different session generation.
    if (
      originalRequest._sessionGeneration !== undefined &&
      originalRequest._sessionGeneration !== sessionGeneration
    ) {
      return Promise.reject(error);
    }

    // Each request is retried at most once, which also rules out refresh loops.
    if (originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (wasSentWithOlderAccessToken(originalRequest)) {
      applyAccessToken(originalRequest, getAccessToken());
      return api(originalRequest);
    }

    try {
      const accessToken = await refreshAccessToken();
      // Ensure the session generation did not change while waiting for refresh
      if (
        originalRequest._sessionGeneration !== undefined &&
        originalRequest._sessionGeneration !== sessionGeneration
      ) {
        return Promise.reject(error);
      }
      applyAccessToken(originalRequest, accessToken);
      return api(originalRequest);
    } catch (refreshError) {
      // Network errors and HTTP 5xx on refresh must not destroy a valid session;
      // only a definitive auth failure logs out. A failure produced by a refresh
      // that was started for an older session must never clear a newer session's
      // tokens (e.g. logout + login while that refresh was still in flight).
      const currentRefreshToken = getRefreshToken();
      const isStaleSession =
        (refreshError?.generation !== undefined && refreshError.generation !== sessionGeneration) ||
        (Boolean(refreshError?.refreshToken) &&
         Boolean(currentRefreshToken) &&
         refreshError.refreshToken !== currentRefreshToken);

      if (
        !isStaleSession &&
        (isDefinitiveAuthFailure(refreshError) || !currentRefreshToken)
      ) {
        clearTokens(refreshError?.generation);
      }
      return Promise.reject(refreshError);
    }
  }
);

// -------------- 5. التجديد الخلفي (كل 25 ثانية) --------------
const REFRESH_INTERVAL_MS = 25000;
const REFRESH_RETRY_DELAY_MS = 3000;

let consecutiveRefreshFailures = 0;
let refreshIntervalId = null;
let refreshRetryTimeoutId = null;
let autoRefreshEnabled = false;

const clearScheduledRetry = () => {
  if (refreshRetryTimeoutId !== null) {
    clearTimeout(refreshRetryTimeoutId);
    refreshRetryTimeoutId = null;
  }
};

const attemptBackgroundRefresh = async () => {
  // A stopped refresher must not start a new attempt, even when a tick or a
  // scheduled retry was already queued when logout (or unmount) stopped it.
  if (!autoRefreshEnabled) return;
  if (!getRefreshToken()) return;

  try {
    await refreshAccessToken();
    consecutiveRefreshFailures = 0;
    clearScheduledRetry();
  } catch (error) {
    // Stopped while this refresh was in flight: schedule nothing else.
    if (!autoRefreshEnabled) return;

    // Tokens may have been cleared by the interceptor while this refresh failed.
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) return;

    // Ignore a failure that belongs to a session which has already been replaced
    // (logout + login): it must not count against the new session's retry policy.
    const isStaleSession =
      (error?.generation !== undefined && error.generation !== sessionGeneration) ||
      (error?.refreshToken && error.refreshToken !== currentRefreshToken);
    if (isStaleSession) return;

    if (isDefinitiveAuthFailure(error)) {
      consecutiveRefreshFailures++;
      console.warn(`[Auth] Background refresh failed (${consecutiveRefreshFailures}/3)`);

      if (consecutiveRefreshFailures >= 3) {
        console.error('[Auth] Persistent refresh failed - clearing tokens and redirecting');
        clearTokens(error?.generation);
        consecutiveRefreshFailures = 0;
        clearScheduledRetry();
        // Force redirect to login to get new tokens
        window.location.href = '/login';
      } else if (refreshRetryTimeoutId === null) {
        refreshRetryTimeoutId = setTimeout(() => {
          refreshRetryTimeoutId = null;
          attemptBackgroundRefresh();
        }, REFRESH_RETRY_DELAY_MS);
      }
    }
  }
};

export const stopTokenAutoRefresh = () => {
  // Stops the periodic refresher and cancels any scheduled retry. Tokens are
  // deliberately NOT cleared here: ending the local session stays logout's job.
  autoRefreshEnabled = false;
  consecutiveRefreshFailures = 0;

  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }

  clearScheduledRetry();
};

export const startTokenAutoRefresh = () => {
  // Idempotent: StrictMode double effects, remounts and repeated calls must not
  // stack loops. A stopped refresher resumes correctly through this function.
  if (refreshIntervalId !== null) {
    autoRefreshEnabled = true;
    return;
  }

  autoRefreshEnabled = true;

  // تشغيل أولي فوراً لضمان صلاحية التوكن عند البداية
  attemptBackgroundRefresh();

  // ثم كل 25 ثانية (أقل قليلاً من 30 ثانية للأمان)
  refreshIntervalId = setInterval(attemptBackgroundRefresh, REFRESH_INTERVAL_MS);
};

export default api;
