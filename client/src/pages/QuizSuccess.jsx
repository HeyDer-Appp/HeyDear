import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';
import PushPrompt from '../components/PushPrompt';
import { clearCached } from '../utils/cache';

export default function QuizSuccess() {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState(null);
  const sessionId = searchParams.get('session_id');

  // Every path that lands here means the dashboard's cached profile/dinners
  // (from before this signup or booking completed) is now stale — cleared
  // so the dashboard does a real fetch next, instead of briefly showing
  // "build your profile" or an old dinner list before revalidating.
  useEffect(() => {
    clearCached('portal_profile');
    clearCached('portal_dinners');
  }, []);

  useEffect(() => {
    const submitIfNeeded = async () => {
      const savedAnswers = sessionStorage.getItem('heyder_quiz_answers');
      if (!savedAnswers || submitted) return;

      try {
        const answers = JSON.parse(savedAnswers);
        const res = await api.post('/profile/submit', {
          ...answers,
          field_OVB7lzEjSl7C: answers.field_OVB7lzEjSl7C || [],
          stripe_session_id: sessionId,
        });
        sessionStorage.removeItem('heyder_quiz_answers');
        setSubmitted(true);
        if (res?.data?.userId) setUserId(res.data.userId);
      } catch (err) {
        console.error('Post-payment submission error:', err);
      }
    };

    submitIfNeeded();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-6 text-center">
      <img
        src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
        alt="HeyDer"
        className="h-10 mb-12"
      />

      <div className="w-16 h-16 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mb-8">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8A854" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="font-serif text-4xl md:text-5xl text-cream mb-4">
        You're in.
      </h1>
      <p className="font-sans text-cream/60 text-base max-w-md mb-3 leading-relaxed">
        Your booking is confirmed. We're working on finding you the right group for your Tuesday dinner.
      </p>
      <p className="font-sans text-cream/40 text-sm mb-10">
        Every update happens right here in the app — no emails to keep track of.
      </p>

      <div className="bg-dark-card rounded-2xl p-8 border border-white/5 max-w-sm w-full mb-10 text-left space-y-3">
        <p className="font-sans text-cream/50 text-sm">
          <span className="text-yellow font-bold">— </span>You'll hear from us when your group is ready
        </p>
        <p className="font-sans text-cream/50 text-sm">
          <span className="text-yellow font-bold">— </span>A glimpse of your table arrives 48 hours before
        </p>
        <p className="font-sans text-cream/50 text-sm">
          <span className="text-yellow font-bold">— </span>Venue revealed 24 hours before dinner
        </p>
        <p className="font-sans text-cream/50 text-sm">
          <span className="text-yellow font-bold">— </span>Tuesday. 7pm. Just show up.
        </p>
      </div>

      <Link to="/portal/dashboard" className="btn-primary">View My Booking</Link>

      <p className="font-sans text-cream/30 text-xs mt-10">
        Questions? <a href="mailto:info@heyder.nz" className="text-gold/70 hover:text-gold">info@heyder.nz</a>
      </p>

      {/* Push notification prompt — shown after signup */}
      <PushPrompt userId={userId} />
    </div>
  );
}
