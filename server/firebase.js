const { initializeApp, cert, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Local dev / CI can point at the Firebase Local Emulator Suite via
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST — the Admin SDK
// picks those up automatically, so a dummy project id is enough there.
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: usingEmulator
    ? applicationDefault()
    : cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Render's env var UI can't store real newlines, so the private key
        // is stored with literal "\n" and unescaped here.
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
  projectId: process.env.FIREBASE_PROJECT_ID || 'heyder-dev',
});

const db = getFirestore(app);
const auth = getAuth(app);

// Shim so route files can keep using `admin.firestore.FieldValue.serverTimestamp()`
// and `admin.firestore.Timestamp.fromMillis()` etc. without every call site
// needing its own import from 'firebase-admin/firestore'.
const admin = { firestore: { FieldValue, Timestamp } };

module.exports = { admin, db, auth };
