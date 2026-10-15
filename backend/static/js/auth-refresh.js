/**
 * auth-refresh.js
 * Automatic token refresh mechanism for Django Templates.
 * This script runs in the background and hits the refresh endpoint
 * before the access token expires (set to 60s, so we refresh at 50s).
 */

(function () {
    const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes (Access token is 5m)
    const REFRESH_URL = '/api/token/refresh/';
    const LOGIN_URL = '/login/'; // Adjust according to your URLs

    function refreshToken() {
        console.log('[Auth] Refreshing token...');

        fetch(REFRESH_URL, {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json',
            }
        })
            .then(response => {
                if (response.ok) {
                    console.log('[Auth] Token rotated successfully.');
                } else if (response.status === 401) {
                    console.warn('[Auth] Session expired. Redirecting to login...');
                    window.location.href = LOGIN_URL;
                }
            })
            .catch(error => {
                console.error('[Auth] Refresh error:', error);
            });
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Start the refresh cycle
    setInterval(refreshToken, REFRESH_INTERVAL);

    // Initial check (optional)
    // refreshToken();
})();
