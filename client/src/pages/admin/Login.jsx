import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function AdminLogin() {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginAdmin(form.email, form.password);
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-9 mx-auto mb-4" />
          <p className="font-sans text-cream/40 text-sm">Admin Portal</p>
        </div>

        <div className="card">
          <h1 className="font-serif text-2xl text-cream mb-6">Sign in</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              className="input-field"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              required
              className="input-field"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <a href="/" className="font-sans text-cream/30 text-xs hover:text-cream/60 transition-colors">← Back to HeyDer</a>
        </p>
      </div>
    </div>
  );
}

function friendlyError(err) {
  const code = err.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found with that email.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  return err.message || 'Login failed';
}
