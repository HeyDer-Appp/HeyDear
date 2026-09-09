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
  // Firebase ID tokens expire hourly and the SDK auto-refreshes them, so we
  // always ask for the current one rather than caching a static token.
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    // A 401 can happen on a perfectly valid session — e.g. a request that
    // raced Firebase's own background token refresh and picked up a token
    // that expired a moment earlier. Retry once with a force-refreshed
    // token before treating this as a real sign-out, so a brief timing
    // hiccup doesn't boot someone out of the app for no reason.
    if (err.response?.status === 401 && config && !config._retried && auth.currentUser) {
      config._retried = true;
      try {
        const token = await auth.currentUser.getIdToken(true);
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      } catch {
        // fall through to sign-out below
      }
    }
    if (err.response?.status === 401) {
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
