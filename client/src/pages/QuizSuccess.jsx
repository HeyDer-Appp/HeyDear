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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#E7DFC5' }}>
      <img
        src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
        alt="HeyDer"
        className="h-10 mb-12 brightness-0"
      />

      <div className="w-16 h-16 rounded-full bg-navy/5 border-2 border-navy flex items-center justify-center mb-8">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16181d" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="font-serif font-bold text-4xl md:text-5xl text-navy mb-4">
        You're in.
      </h1>
      <p className="font-sans text-navy/60 text-base max-w-md mb-3 leading-relaxed">
        Your booking is confirmed. We're working on finding you the right group for your Tuesday dinner.
      </p>
      <p className="font-sans text-navy/45 text-sm mb-10">
        Every update happens right here in the app — no emails to keep track of.
      </p>

      <div className="rounded-2xl p-8 border border-navy/15 max-w-sm w-full mb-10 text-left space-y-3" style={{ background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(10px) saturate(140%)', WebkitBackdropFilter: 'blur(10px) saturate(140%)' }}>
        <p className="font-sans text-navy/60 text-sm">
          <span className="text-navy font-bold">— </span>You'll hear from us when your group is ready
        </p>
        <p className="font-sans text-navy/60 text-sm">
          <span className="text-navy font-bold">— </span>A glimpse of your table arrives 48 hours before
        </p>
        <p className="font-sans text-navy/60 text-sm">
          <span className="text-navy font-bold">— </span>Venue revealed 24 hours before dinner
        </p>
        <p className="font-sans text-navy/60 text-sm">
          <span className="text-navy font-bold">— </span>Tuesday. 7pm. Just show up.
        </p>
      </div>

      <Link
        to="/portal/dashboard"
        className="inline-block border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream"
      >
        View My Booking
      </Link>

      <p className="font-sans text-navy/40 text-xs mt-10">
        Questions? <a href="mailto:info@heyder.nz" className="text-navy underline hover:text-navy/60">info@heyder.nz</a>
      </p>

      {/* Push notification prompt — shown after signup */}
      <PushPrompt userId={userId} />
    </div>
  );
}
