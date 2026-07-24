import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

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

  const [form, setForm] = useState({
    overall_rating: 0,
    surprised_by: '',
    group_fit: 0,
    conversation_quality: 0,
    venue_rating: 0,
    return_likelihood: '',
    nps: 0,
    improvement: '',
    testimonial: '',
    testimonial_name: '',
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
        <Link to="/" className="btn-primary">Back to HeyDer</Link>
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
        <p className="font-sans text-cream/50 text-center mb-10 text-sm">2 minutes. Your feedback directly shapes the experience.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">Overall experience *</label>
            <StarRating value={form.overall_rating} onChange={v => set('overall_rating', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-3">What surprised you?</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Something you didn't expect..."
              value={form.surprised_by}
              onChange={e => set('surprised_by', e.target.value)}
            />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">Did the group feel right? *</label>
            <StarRating value={form.group_fit} onChange={v => set('group_fit', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">How was the conversation? *</label>
            <StarRating value={form.conversation_quality} onChange={v => set('conversation_quality', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">How was the restaurant?</label>
            <StarRating value={form.venue_rating} onChange={v => set('venue_rating', v)} />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-4">Would you come back?</label>
            <div className="flex gap-3 flex-wrap">
              {['Yes, definitely', 'Maybe', 'Not sure yet', 'No'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('return_likelihood', opt)}
                  className={`px-4 py-2 rounded-lg border font-sans text-sm transition-all ${
                    form.return_likelihood === opt
                      ? 'border-gold bg-gold/15 text-cream'
                      : 'border-white/10 text-cream/60 hover:border-gold/30'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-2">
              NPS — How likely are you to recommend HeyDer? (1-10)
            </label>
            <p className="font-sans text-cream/40 text-xs mb-4">1 = Not at all, 10 = Absolutely</p>
            <div className="flex gap-2 flex-wrap">
              {[...Array(10)].map((_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set('nps', n)}
                    className={`w-10 h-10 rounded-lg font-sans text-sm font-medium transition-all ${
                      form.nps === n ? 'bg-gold text-navy' : 'bg-dark-card text-cream/60 hover:bg-gold/20 border border-white/5'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-3">One thing we could improve</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Be honest — it helps us get better."
              value={form.improvement}
              onChange={e => set('improvement', e.target.value)}
            />
          </div>

          <div className="card">
            <label className="font-sans text-cream font-medium block mb-3">
              One sentence testimonial{' '}
              <span className="text-cream/40 font-normal text-sm">(optional — may be published)</span>
            </label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder="What would you tell a friend about HeyDer?"
              value={form.testimonial}
              onChange={e => set('testimonial', e.target.value)}
            />
            {form.testimonial && (
              <input
                className="input-field mt-3"
                placeholder="Your name (optional)"
                value={form.testimonial_name}
                onChange={e => set('testimonial_name', e.target.value)}
              />
            )}
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
