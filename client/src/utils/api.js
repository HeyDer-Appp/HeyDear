import axios from 'axios';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

// In local dev this stays '/api' and Vite proxies it to the backend (see vite.config.js).
// In production the frontend and backend are deployed as separate services with different
// domains, so VITE_API_URL must point at the backend's full URL, e.g. https://heyder-server.onrender.com
// Some hosts (e.g. Render's `fromService` blueprint property) only supply the bare hostname
// with no scheme, so prepend https:// if it's missing rather than building a broken relative URL.
let apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
if (apiUrl && !/^https?:\/\//.test(apiUrl)) apiUrl = `https://${apiUrl}`;
const baseURL = apiUrl ? `${apiUrl}/api` : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // Firebase restores the saved login asynchronously when the app starts —
  // notably when it is opened by tapping a notification, which lands straight
  // on a signed-in screen. A request fired in that gap used to go out with no
  // token, come back 401, and get the person signed out. So wait for the
  // restore to finish first (resolves immediately once it has).
  try { await auth.authStateReady(); } catch { /* carry on; the 401 path below is careful too */ }
  // Firebase ID tokens expire hourly and the SDK auto-refreshes them, so we
  // always ask for the current one rather than caching a static token.
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Firebase errors that mean the saved session itself is finished (as opposed
// to, say, a failed network call while refreshing it).
const SESSION_ENDED_CODES = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    // Only a request that actually carried a token can prove the session is bad.
    // A 401 for a request that had none just means "not signed in (yet)".
    const sentToken = !!(config && config.headers && (config.headers.Authorization || (config.headers.get && config.headers.get('Authorization'))));
    // A 401 can happen on a perfectly valid session — e.g. a request that
    // raced Firebase's own background token refresh and picked up a token
    // that expired a moment earlier. Retry once with a force-refreshed
    // token before treating this as a real sign-out, so a brief timing
    // hiccup doesn't boot someone out of the app for no reason.
    if (err.response?.status === 401 && sentToken && config && !config._retried && auth.currentUser) {
      config._retried = true;
      let token;
      try {
        token = await auth.currentUser.getIdToken(true);
      } catch (refreshErr) {
        // Only an account/refresh-token problem means the session is really
        // gone. A flaky connection (a phone that has only just woken up) must
        // not log anyone out — the next request simply tries again.
        if (!SESSION_ENDED_CODES.has(refreshErr && refreshErr.code)) return Promise.reject(err);
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      }
    }
    if (err.response?.status === 401 && sentToken) {
      signOut(auth);
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else if (window.location.pathname.startsWith('/portal')) {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
