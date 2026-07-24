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
  (err) => {
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
