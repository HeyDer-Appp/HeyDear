import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function StarRating({ value, onChange, name }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="star-btn"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={(hovered || value) >= n ? '#f0c040' : 'none'} stroke={(hovered || value) >= n ? '#f0c040' : '#434c59'} strokeWidth="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function Feedback() {
  const { dinnerId } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('uid');
  const { attendeeUser } = useAuth();

  const [form, setForm] = useState({
    overall_rating: 0,
    group_fit: 0,
    venue_rating: 0,
    experience_notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.overall_rating) { toast.error('Please rate your experience'); return; }
    setSubmitting(true);
    try {
      await api.post('/feedback/submit', { ...form, userId, dinnerId });
      setSubmitted(true);
    } catch {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 text-center">
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-9 mb-10" />
        <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8A854" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="font-serif text-4xl text-cream mb-4">Thank you.</h1>
        <p className="font-sans text-cream/60 max-w-sm mb-8">Your feedback shapes who we match and how we run every dinner.</p>
        <Link to={attendeeUser ? '/portal/dashboard' : '/'} className="btn-primary">Back to HeyDer</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center mb-10">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-8" />
        </div>

        <h1 className="font-serif text-4xl text-cream text-center mb-2">How was it?</h1>
        <p className="font-sans text-cream/50 text-center mb-10 text-sm">Takes 30 seconds. Your feedback directly shapes the experience.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">Rate your overall dinner out of 5 *</label>
            <StarRating value={form.overall_rating} onChange={v => set('overall_rating', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">Did the table feel matched for you?</label>
            <StarRating value={form.group_fit} onChange={v => set('group_fit', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">How was the restaurant we chose for you?</label>
            <StarRating value={form.venue_rating} onChange={v => set('venue_rating', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-3">Few words if you could share about your experience</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Anything you'd like to tell us..."
              value={form.experience_notes}
              onChange={e => set('experience_notes', e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting ? <><div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" /> Submitting...</> : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
