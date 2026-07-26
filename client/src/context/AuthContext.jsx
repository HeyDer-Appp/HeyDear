import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

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

      const tokenResult = await fbUser.getIdTokenResult();
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
    const tokenResult = await cred.user.getIdTokenResult();
    if (tokenResult.claims.role !== 'admin') {
      await signOut(auth);
      throw new Error('This account does not have admin access.');
    }
    return cred.user;
  };

  const logout = () => signOut(auth);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  return (
    <AuthContext.Provider value={{ adminUser, attendeeUser, signupAttendee, loginAttendee, loginAdmin, logout, resetPassword, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
