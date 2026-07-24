import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function PortalLogin() {
  const { signupAttendee, loginAttendee } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signupAttendee(form.email, form.password);
        await api.post('/auth/attendee/register', { firstName: form.firstName, lastName: form.lastName });
        navigate('/profile');
      } else {
        await loginAttendee(form.email, form.password);
        navigate('/portal/dashboard');
      }
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
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

          <h1 className="font-serif text-2xl text-cream mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="font-sans text-cream/50 text-sm mb-6">
            {mode === 'signin' ? 'Sign in to view your bookings.' : "We'll use this to build your HeyDer profile next."}
          </p>

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
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account & Build Profile'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 font-sans text-cream/40 text-sm">
          {mode === 'signin' ? (
            <>Not signed up yet?{' '}
              <button onClick={() => setMode('signup')} className="text-gold hover:text-yellow transition-colors">Create an account →</button>
            </>
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
