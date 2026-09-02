import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="quiz-bg min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <Link to="/">
            <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-9 mx-auto mb-4" />
          </Link>
          <p className="font-sans text-cream/40 text-sm">My Account</p>
        </div>

        <div className="quiz-card">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-xl text-sm font-sans transition-all ${mode === 'signin' ? 'bg-gold text-navy font-semibold' : 'text-cream/50 hover:text-cream/80'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-xl text-sm font-sans transition-all ${mode === 'signup' ? 'bg-gold text-navy font-semibold' : 'text-cream/50 hover:text-cream/80'}`}
            >
              Create account
            </button>
          </div>

          <h1 className={`font-serif text-2xl text-cream mb-2 ${mode === 'signin' ? 'mb-6' : ''}`}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          {mode === 'signup' && (
            <p className="font-sans text-cream/50 text-sm mb-6">
              We'll use this to build your HeyDer profile next.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First name" required className="quiz-input" value={form.firstName} onChange={set('firstName')} />
                <input type="text" placeholder="Last name" required className="quiz-input" value={form.lastName} onChange={set('lastName')} />
              </div>
            )}
            <input
              type="email"
              placeholder="Your email address"
              required
              className="quiz-input"
              value={form.email}
              onChange={set('email')}
            />
            <input
              type="password"
              placeholder="Password"
              required
              minLength={8}
              className="quiz-input"
              value={form.password}
              onChange={set('password')}
            />
            <button type="submit" disabled={loading} className="quiz-cta w-full">
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Build Profile'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 font-sans text-cream/40 text-sm">
          {mode === 'signin' ? (
            <button onClick={handleForgotPassword} className="text-gold hover:text-yellow transition-colors">Forgot password?</button>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-gold hover:text-yellow transition-colors">Sign in →</button>
            </>
          )}
        </p>
        <p className="text-center mt-4">
          <Link to="/" className="font-sans text-cream/30 text-xs hover:text-cream/60">← Back to HeyDer</Link>
        </p>
      </div>
    </div>
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
