// Demo-mode stand-in for firebase/auth: an in-memory user table, password "demo123".
const accounts = new Map(); // email -> { uid, password }
const auths = new Map(); // app name -> auth object
const listeners = new Set();

export const DEMO_PASSWORD = 'demo123';
export const registerDemoAccount = (email, uid, password = DEMO_PASSWORD) => accounts.set(email.toLowerCase(), { uid, password });

export function getAuth(app = { name: '[DEFAULT]' }) {
  if (!auths.has(app.name)) auths.set(app.name, { app, currentUser: null, isMain: app.name === '[DEFAULT]' });
  return auths.get(app.name);
}

const emit = (auth) => auth.isMain && listeners.forEach((cb) => cb(auth.currentUser));

export function onAuthStateChanged(auth, cb) {
  listeners.add(cb);
  setTimeout(() => cb(auth.currentUser), 0);
  return () => listeners.delete(cb);
}

const authError = (code) => Object.assign(new Error(code), { code });

export async function signInWithEmailAndPassword(auth, email, password) {
  const a = accounts.get(String(email).toLowerCase());
  if (!a || a.password !== password) throw authError('auth/invalid-credential');
  auth.currentUser = { uid: a.uid, email };
  emit(auth);
  return { user: auth.currentUser };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const key = String(email).toLowerCase();
  if (accounts.has(key)) throw authError('auth/email-already-in-use');
  const uid = `demo-${Math.random().toString(36).slice(2, 10)}`;
  accounts.set(key, { uid, password });
  const user = { uid, email };
  if (auth.isMain) { auth.currentUser = user; emit(auth); }
  return { user };
}

export async function signOut(auth) {
  auth.currentUser = null;
  emit(auth);
}
export const updateProfile = async () => {};
export const sendPasswordResetEmail = async () => {};
