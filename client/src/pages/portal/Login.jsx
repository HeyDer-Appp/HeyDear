import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function PortalLogin() {
  const { attendeeUser, signupAttendee, loginAttendee, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);

  // signupAttendee/loginAttendee resolving doesn't mean AuthContext's
  // attendeeUser is populated yet — that only happens once Firebase's
  // separate onAuthStateChanged listener fires, which lags a moment behind
  // (it does its own forced token refresh). Navigating right after the
  // Firebase call used to race that: PortalRoute would see the still-stale
  // attendeeUser === null and bounce straight back to /portal/login, so
  // signing up or in appeared to silently need doing twice. Waiting for
  // attendeeUser itself before navigating removes the race entirely.
  useEffect(() => {
    if (attendeeUser) navigate('/portal/dashboard');
  }, [attendeeUser, navigate]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      toast.error('Enter your email above first.');
      return;
    }
    try {
      await resetPassword(form.email.trim());
      toast.success('Password reset email sent — check your inbox.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signupAttendee(form.email, form.password);
        await api.post('/auth/attendee/register', { firstName: form.firstName, lastName: form.lastName });
      } else {
        await loginAttendee(form.email, form.password);
      }
      // Navigation happens via the effect above once attendeeUser actually
      // updates — deliberately not calling setLoading(false) here, so the
      // button stays in its "please wait" state for the moment or two until
      // that happens, rather than flashing back to normal first.
    } catch (err) {
      toast.error(friendlyError(err));
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: '#E7DFC5' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: 'easeInOut' }}
    >
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <Link to="/">
            {/* The source asset is solid white with no dark variant — brightness-0
                recolors it to black to work on this light background instead of
                needing a separate logo file. */}
            <img
              src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
              alt="HeyDer"
              className="h-9 mx-auto brightness-0"
            />
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-xl text-sm font-sans transition-all border ${mode === 'signin' ? 'border-navy text-navy font-semibold' : 'border-transparent text-navy/45 hover:text-navy/75'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-xl text-sm font-sans transition-all border ${mode === 'signup' ? 'border-navy text-navy font-semibold' : 'border-transparent text-navy/45 hover:text-navy/75'}`}
          >
            Create account
          </button>
        </div>

        <h1
          className={`text-3xl text-navy mb-2 ${mode === 'signin' ? 'mb-6' : ''}`}
          style={{ fontFamily: "'Permanent Marker', cursive" }}
        >
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="First name" required className="portal-login-input" value={form.firstName} onChange={set('firstName')} />
              <input type="text" placeholder="Last name" required className="portal-login-input" value={form.lastName} onChange={set('lastName')} />
            </div>
          )}
          <input
            type="email"
            placeholder="Your email address"
            required
            className="portal-login-input"
            value={form.email}
            onChange={set('email')}
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            className="portal-login-input"
            value={form.password}
            onChange={set('password')}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-transparent border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Build Profile'}
          </button>
        </form>

        {mode === 'signin' && (
          <p className="text-center mt-6 font-sans text-navy/50 text-sm">
            <button onClick={handleForgotPassword} className="text-navy underline hover:text-navy/60 transition-colors">Forgot password?</button>
          </p>
        )}
      </div>
    </motion.div>
  );
}

function friendlyError(err) {
  const code = err.code || '';
  if (code === 'auth/email-already-in-use') return 'An account with that email already exists — try signing in instead.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found with that email.';
  if (code === 'auth/weak-password') return 'Password must be at least 8 characters.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  return err.response?.data?.error || err.message || 'Something went wrong.';
}
