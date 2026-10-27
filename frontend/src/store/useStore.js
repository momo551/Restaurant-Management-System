
import { create } from 'zustand';
import api, { setTokens, clearTokens, stopTokenAutoRefresh, clearRefreshPromise, getSessionGeneration } from '../api/axios';

const useStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  checkAuth: async () => {
    const currentGen = getSessionGeneration();
    try {
      const res = await api.get('/users/me/', { _sessionGeneration: currentGen });
      if (currentGen !== getSessionGeneration()) return;
      set({ user: res.data, isAuthenticated: true, loading: false });
    } catch (err) {
      if (currentGen !== getSessionGeneration()) return;
      const status = err?.response?.status;

      if (status === 401) {
        // The axios interceptor already tried to refresh the access token and
        // failed (or there is no refresh token), so the session is really over.
        clearTokens(currentGen);
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      // 403 = authenticated but not allowed. /users/me/ only requires
      // IsAuthenticated, so a 403 here does not mean an expired session: keep the
      // tokens. Network errors, 5xx and 429 are transient verification failures
      // and must not destroy a valid session either.
      //
      // In both cases the server could not confirm the user, so this never turns
      // into a fresh authentication: a first-time check stays signed out (with
      // the tokens preserved), while an already verified session keeps its state
      // so a temporary outage does not log the user out.
      const hadVerifiedUser = Boolean(get().user);
      set(
        hadVerifiedUser
          ? { loading: false }
          : { user: null, isAuthenticated: false, loading: false }
      );
    }
  },

  login: async (username, password) => {
    // Invalidate any in-flight refresh or previous login operations
    // before initiating a new login.
    clearRefreshPromise();
    const loginGen = getSessionGeneration();
    try {
      const { data } = await api.post('/token/', { username, password }, { _sessionGeneration: loginGen });
      if (loginGen !== getSessionGeneration()) {
        return { success: false, error: 'تم تجاوز جلسة تسجيل الدخول' };
      }
      setTokens(data.access, data.refresh);
      await get().checkAuth();
      if (loginGen !== getSessionGeneration()) {
        return { success: false, error: 'تم تجاوز جلسة تسجيل الدخول' };
      }
      return { success: true };
    } catch (err) {
      if (loginGen !== getSessionGeneration()) {
        return { success: false };
      }
      return { success: false, error: err.response?.data?.detail || 'فشل تسجيل الدخول' };
    }
  },

  logout: async () => {
    // Stop the periodic refresher (and any scheduled retry) before revoking, so
    // no background attempt can race with the logout calls below. Tokens are not
    // cleared here: the exit path below still needs a valid access token.
    stopTokenAutoRefresh();

    // Invalidate any in-flight refresh operations from the old session by bumping
    // the session generation. This prevents an old refresh from saving tokens after
    // a new login (even if the refresh token value is the same).
    clearRefreshPromise();
    const logoutGen = getSessionGeneration();

    const sentRefresh = localStorage.getItem('refresh_token');

    try {
      if (sentRefresh) {
        try {
          await api.post('/logout/', { refresh: sentRefresh }, { _sessionGeneration: logoutGen });
        } catch {
          // Server-side revocation is best effort; the local session still ends.
        }

        // If a new session started while the first logout request was in flight,
        // do not revoke whatever refresh token is now in localStorage.
        if (logoutGen !== getSessionGeneration()) return;

        // If the access token had expired, the axios interceptor refreshed the
        // session while handling that request, so the body above carried the old
        // (already blacklisted by rotation) refresh token. Revoke the newly
        // issued one too, otherwise it would stay valid on the server after the
        // user has logged out locally.
        const currentRefresh = localStorage.getItem('refresh_token');
        if (currentRefresh && currentRefresh !== sentRefresh) {
          if (logoutGen !== getSessionGeneration()) return;
          try {
            await api.post('/logout/', { refresh: currentRefresh }, { _sessionGeneration: logoutGen });
          } catch {
            // Best effort only: a network failure must not keep the local
            // session alive.
          }
        }
      }
    } finally {
      // End the local session only if this logout operation still matches
      // the current session generation. Never wipe a newer session's tokens or state.
      if (logoutGen === getSessionGeneration()) {
        clearTokens(logoutGen);
        set({ user: null, isAuthenticated: false });
      }
    }
  },
}));

export default useStore;
