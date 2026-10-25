import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'heyder-dev',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
// Where the signed-in session is kept. Firebase's default prefers IndexedDB, which
// on iPhone's web view can drop its connection when the app is suspended and the
// person then finds themselves signed out. localStorage first is steadier there;
// IndexedDB and session storage stay as fallbacks. (A session already stored in
// IndexedDB is still found and used — this only changes where new sign-ins go.)
let authInstance;
try {
  authInstance = initializeAuth(app, { persistence: [browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence] });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

// Ask the browser not to clear this site's storage when it's short on space or
// the app hasn't been opened for a while (iOS is quick to do that).
try { navigator.storage?.persist?.(); } catch { /* not supported */ }

// Local dev only: point at the Firebase Local Emulator Suite instead of a
// real project — see VITE_FIREBASE_AUTH_EMULATOR_URL in .env.example.
if (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL, { disableWarnings: true });
}
