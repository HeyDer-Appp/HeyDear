import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import api from '../utils/api';
import PushPrompt from '../components/PushPrompt';
import { clearCached } from '../utils/cache';
import { success as hapticSuccess } from '../utils/haptics';

const PLAN_LABEL = { one_time: 'One-time', subscription: 'Monthly' };

export default function QuizSuccess() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => { hapticSuccess(); }, []);

  // Coming straight from the My Table confirm card already knows the date/
  // city/plan (state) — everyone else (a real Stripe redirect, which loses
  // that state) falls back to just-in-time fetching the dinner this
  // submission created.
  const [booking, setBooking] = useState(() => location.state || null);

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

  // Only needed when we didn't already get the details handed to us via
  // navigation state (a real Stripe checkout redirect is a fresh page load,
  // so whatever the My Table card knew doesn't survive the round trip).
  useEffect(() => {
    if (booking) return;
    api.get('/portal/dinners').then(res => {
      const upcoming = (res.data.dinners || []).find(d => d.is_pending || !d.date || new Date(d.date) >= new Date());
      if (!upcoming) return;
      setBooking({
        date: upcoming.date
          ? new Date(upcoming.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' })
          : upcoming.preferred_date,
        city: upcoming.city,
        plan: undefined,
      });
    }).catch(() => {});
  }, [booking]);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-16">
      <img
        src="/images/auckland-map-beige.png"
        alt=""
        aria-hidden="true"
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <img
          src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png"
          alt="HeyDer"
          className="h-8 mb-8 brightness-0"
        />

        {/* Ticket stub — perforated divider between "what you booked" and
            the receipt-style details, so a dinner reservation reads as a
            real, physical-feeling thing rather than a form's success state. */}
        <div
          className="w-full rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(245,237,216,0.94)', boxShadow: '0 20px 44px rgba(22,24,29,0.25)' }}
        >
          <div className="px-6 pt-7 pb-4 text-center">
            <p className="font-sans font-bold text-[10px] tracking-[0.12em] uppercase mb-1.5" style={{ color: '#754471' }}>
              Confirmed
            </p>
            <h1 className="font-serif font-bold text-2xl text-navy mb-1">Dinner + Afterparty</h1>
            <p className="font-sans text-navy/60 text-sm">
              {booking?.date || 'This Tuesday'} &middot; 7:00 PM
            </p>
          </div>

          {/* Perforation — a plain dashed tear-line rather than punched
              "holes", since those would need to fake transparency through
              to the map background behind the card instead of just this
              card's own cream surface. */}
          <div className="border-t-2 border-dashed border-navy/20 mx-6" />

          <div className="px-6 pt-4 pb-7 space-y-1">
            <div className="flex justify-between font-sans text-xs py-1.5">
              <span className="text-navy/60">City</span>
              <span className="text-navy font-semibold">{booking?.city || 'Auckland'}</span>
            </div>
            <div className="flex justify-between font-sans text-xs py-1.5">
              <span className="text-navy/60">Plan</span>
              <span className="text-navy font-semibold">{PLAN_LABEL[booking?.plan] || 'One-time'}</span>
            </div>
            <div className="flex justify-between font-sans text-xs py-1.5">
              <span className="text-navy/60">Group reveal</span>
              <span className="text-navy font-semibold">48 hrs before</span>
            </div>
            <div className="flex justify-between font-sans text-xs py-1.5">
              <span className="text-navy/60">Venue reveal</span>
              <span className="text-navy font-semibold">24 hrs before</span>
            </div>
          </div>
        </div>

        <p className="font-sans text-navy/50 text-xs text-center mt-6 max-w-xs leading-relaxed">
          Every update happens right here in the app — no emails to keep track of.
        </p>

        <Link
          to="/portal/dashboard"
          className="inline-block border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream mt-8"
        >
          View My Booking
        </Link>

        <p className="font-sans text-navy/40 text-xs mt-8">
          Questions? <a href="mailto:info@heyder.nz" className="text-navy underline hover:text-navy/60">info@heyder.nz</a>
        </p>
      </div>

      {/* Push notification prompt — shown after signup */}
      <PushPrompt userId={userId} />
    </div>
  );
}
