import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { clearAllCached } from '../utils/cache';
import { unlinkStoredPushToken } from '../utils/push';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [attendeeUser, setAttendeeUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAdminUser(null);
        setAttendeeUser(null);
        setLoading(false);
        return;
      }

      // Force a refresh — right after sign-in, the Auth emulator doesn't
      // reliably bake newly-set custom claims (e.g. role: admin) into the
      // first unforced token read, which was bouncing fresh admin logins
      // straight back out.
      const tokenResult = await fbUser.getIdTokenResult(true);
      const profile = { uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName };

      if (tokenResult.claims.role === 'admin') {
        setAdminUser(profile);
        setAttendeeUser(null);
      } else {
        setAttendeeUser(profile);
        setAdminUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signupAttendee = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const loginAttendee = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const loginAdmin = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const tokenResult = await cred.user.getIdTokenResult(true);
    if (tokenResult.claims.role !== 'admin') {
      await signOut(auth);
      throw new Error('This account does not have admin access.');
    }
    return cred.user;
  };

  // Cleared here (not just on delete-account) so a different account
  // logging into the same device — common on shared/test devices during
  // beta testing — never briefly sees the previous person's cached data.
  // The device stays subscribed as a guest (still gets general announcements),
  // but is detached from this account while the login token still works.
  const logout = async () => {
    await unlinkStoredPushToken();
    clearAllCached();
    return signOut(auth);
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  return (
    <AuthContext.Provider value={{ adminUser, attendeeUser, signupAttendee, loginAttendee, loginAdmin, logout, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
