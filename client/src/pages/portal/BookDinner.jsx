import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fadeUpVariant, staggerContainerVariant, fadeLeftVariant, choiceBase, choiceIdle, choiceActive, DATE_Q } from '../Quiz';
import BottomNav from '../../components/BottomNav';

// Booking again is just "pick a Tuesday, pay (or not, if subscribed)" — a
// returning member's profile is already built, so this is a dedicated,
// two-step page rather than sending them back through the profile quiz.
export default function BookDinner() {
  const { attendeeUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [answers, setAnswers] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [dateChoices, setDateChoices] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [step, setStep] = useState('date');
  const [submitting, setSubmitting] = useState(false);
  const [pricing, setPricing] = useState({ oneTimeAmount: 1000, subscriptionAmount: 1500 });
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const stripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    api.get('/payments/pricing').then(res => setPricing(res.data)).catch(() => {});
  }, []);

  // Same as Quiz.jsx's handlePayment: on native builds, Stripe opens in the
  // phone's own browser, so this page never actually navigates away — it's
  // still sitting here, frozen mid "Processing...", whenever the app is
  // switched back into. Check on resume whether the payment actually went
  // through instead of leaving that button stuck forever.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const checkPendingPayment = async () => {
      const pendingSessionId = sessionStorage.getItem('heyder_pending_session_id');
      if (!pendingSessionId || cancelled) return;
      attempts += 1;
      try {
        const res = await api.get(`/payments/verify/${pendingSessionId}`);
        if (cancelled) return;
        if (res.data.paid) {
          sessionStorage.removeItem('heyder_pending_session_id');
          navigate('/profile/success');
          return;
        }
      } catch {
        // ignore — treated the same as "not confirmed yet" below
      }
      if (attempts < 3) {
        setTimeout(checkPendingPayment, 2500);
      } else {
        sessionStorage.removeItem('heyder_pending_session_id');
        setSubmitting(false);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') { attempts = 0; checkPendingPayment(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    checkPendingPayment();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [navigate]);

  useEffect(() => {
    Promise.all([
      api.get('/portal/full-profile'),
      api.get('/profile/questions'),
      api.get('/portal/dinners'),
    ]).then(([profileRes, questionsRes, dinnersRes]) => {
      const { locked, hasActiveSubscription: hasSub, photo, answers: savedAnswers, profileComplete } = profileRes.data;
      if (!profileComplete) {
        // Nothing built yet — this page has nothing to work with.
        navigate('/profile', { replace: true });
        return;
      }

      // One dinner at a time — same rule the server enforces on submit,
      // checked here too so nobody fills out the whole flow just to hit
      // an error at the very end.
      const now = new Date();
      const hasUpcoming = (dinnersRes.data.dinners || []).some(d => d.is_pending || !d.date || new Date(d.date) >= now);
      if (hasUpcoming) {
        setAlreadyBooked(true);
        return;
      }

      setAnswers({
        first_name: locked.first_name,
        last_name: locked.last_name,
        phone: locked.phone,
        dob: locked.dob,
        gender: locked.gender,
        country: locked.country,
        photo: photo || undefined,
        ...savedAnswers,
      });
      setHasActiveSubscription(!!hasSub);
      const dateQuestion = questionsRes.data.questions?.find(q => q.id === 'CdZldwp5q09o');
      setDateChoices(dateQuestion?.choices || []);
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [navigate]);

  // plan is only relevant in test mode (no Stripe key) — a real Stripe
  // session already tells the server which plan was bought via
  // reconcileStripeSession, but a simulated booking has no session to read
  // that from, so it has to be passed through explicitly or "subscription"
  // silently produces zero subscription record at all.
  const submitBooking = async (fullAnswers, plan) => {
    try {
      await api.post('/profile/submit', {
        ...fullAnswers,
        field_OVB7lzEjSl7C: fullAnswers.field_OVB7lzEjSl7C || [],
        plan,
      });
      navigate('/profile/success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleConfirmSubscribed = async () => {
    if (!selectedDate) return;
    setSubmitting(true);
    await submitBooking({ ...answers, field_CdZldwp5q09o: selectedDate });
  };

  const handlePayment = async (plan) => {
    if (!selectedDate) return;
    setSubmitting(true);
    const fullAnswers = { ...answers, field_CdZldwp5q09o: selectedDate };
    try {
      if (!stripeConfigured) {
        await submitBooking(fullAnswers, plan);
        return;
      }

      // Save the booking BEFORE sending anyone to pay, not after — see the
      // matching comment in Quiz.jsx's handlePayment for why: Stripe hands
      // off to a different browser context on native apps, which can't
      // finish anything that depends on this page's own state afterward.
      // awaitingPayment marks the new booking unpaid until Stripe actually
      // confirms it — see the matching comment in Quiz.jsx's handlePayment.
      await api.post('/profile/submit', {
        ...fullAnswers,
        field_OVB7lzEjSl7C: fullAnswers.field_OVB7lzEjSl7C || [],
        awaitingPayment: true,
      });

      const res = await api.post('/payments/create-checkout', {
        email: attendeeUser?.email,
        plan,
        couponCode: appliedCoupon?.code,
      });
      sessionStorage.setItem('heyder_quiz_answers', JSON.stringify(fullAnswers));
      sessionStorage.setItem('heyder_pending_session_id', res.data.sessionId);
      // A plain redirect to the URL the server already returned, rather
      // than loading the whole Stripe.js SDK just to call its (now legacy)
      // redirectToCheckout — see the matching comment in Quiz.jsx's
      // handlePayment for why.
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment setup failed. Please try again.');
      setSubmitting(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/payments/validate-coupon', { code: couponInput.trim() });
      setAppliedCoupon({ code: res.data.code, discountPercent: res.data.discountPercent });
      toast.success(`${res.data.discountPercent}% off applied!`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.error || 'That code is invalid or has expired.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); setCouponError(''); };

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Couldn't load booking</p>
          <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
          <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (alreadyBooked) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="text-4xl mb-4">🍽</p>
          <p className="font-serif text-2xl text-cream mb-3">You've already got a dinner booked</p>
          <p className="font-sans text-cream/50 text-sm mb-6 leading-relaxed">
            One Tuesday at a time — cancel your current booking from the dashboard first if you'd like to pick a different date.
          </p>
          <Link to="/portal/dashboard" className="quiz-cta text-sm py-2.5 px-6">Back to dashboard</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div>
          <p className="font-sans text-cream/40 text-sm">Book a dinner</p>
          <h1 className="font-serif text-3xl text-cream mt-1">
            {step === 'date' ? 'Which Tuesday?' : 'Reserve your spot'}
          </h1>
        </div>

        {step === 'date' && (
          <>
            <div className="quiz-card">
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif text-xl text-cream mb-1">{DATE_Q.title}</motion.p>
              <p className="font-sans text-cream/35 text-xs mb-3">Your reservation covers one Tuesday dinner.</p>
              <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="flex flex-wrap gap-2 justify-center">
                {dateChoices.map(choice => (
                  <motion.button
                    key={choice}
                    variants={fadeLeftVariant}
                    type="button"
                    onClick={() => setSelectedDate(choice)}
                    className={`${choiceBase} text-center ${selectedDate === choice ? choiceActive : choiceIdle}`}
                  >
                    {choice}
                  </motion.button>
                ))}
              </motion.div>
            </div>
            <button
              onClick={() => selectedDate && setStep('payment')}
              disabled={!selectedDate}
              className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {hasActiveSubscription ? 'Confirm →' : 'Continue to payment →'}
            </button>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="quiz-card">
              <div className="flex items-center gap-2 mb-1">
                <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif text-xl text-cream">Reserve your spot</motion.p>
                {!stripeConfigured && (
                  <span className="text-[10px] font-sans font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-yellow/15 text-yellow">
                    Test mode
                  </span>
                )}
              </div>
              <p className="font-sans text-cream/35 text-xs mb-4">
                {stripeConfigured
                  ? "Choose how you'd like to join."
                  : 'Payments are not connected yet — booking will be simulated, no card required.'}
              </p>

              {hasActiveSubscription ? (
                <div>
                  <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-4 mb-4 text-center">
                    <p className="font-sans text-cream/70 text-sm">✓ You're covered by your monthly membership — no extra charge.</p>
                  </div>
                  <button
                    onClick={handleConfirmSubscribed}
                    disabled={submitting}
                    className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? 'Confirming...' : 'Confirm Booking'}
                  </button>
                </div>
              ) : (() => {
                const discountPercent = appliedCoupon ? appliedCoupon.discountPercent : 0;
                const baseOneTime = pricing.oneTimeAmount / 100;
                const baseSub = pricing.subscriptionAmount / 100;
                const oneTimePrice = (baseOneTime * (1 - discountPercent / 100)).toFixed(2).replace(/\.00$/, '');
                const subPrice = (baseSub * (1 - discountPercent / 100)).toFixed(2).replace(/\.00$/, '');
                return (
                <div>
                  <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="space-y-3 mb-5">
                    <motion.button
                      variants={fadeLeftVariant}
                      type="button"
                      onClick={() => setSelectedPlan('one_time')}
                      className={`w-full text-left rounded-2xl border p-4 transition-colors duration-200 ${selectedPlan === 'one_time' ? choiceActive : choiceIdle}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-sans font-semibold text-base">One-time reservation</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className={`font-sans text-xs line-through ${selectedPlan === 'one_time' ? 'text-navy/40' : 'text-cream/25'}`}>${baseOneTime.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${oneTimePrice}</span>
                        </span>
                      </div>
                      <p className={`font-sans text-sm ${selectedPlan === 'one_time' ? 'text-navy/60' : 'text-cream/40'}`}>Reserve just this Tuesday's dinner. Refundable up to 48hrs before.</p>
                    </motion.button>
                    <motion.button
                      variants={fadeLeftVariant}
                      type="button"
                      onClick={() => setSelectedPlan('subscription')}
                      className={`w-full text-left rounded-2xl border p-4 transition-colors duration-200 relative ${selectedPlan === 'subscription' ? choiceActive : choiceIdle}`}
                    >
                      <span className="absolute -top-2.5 right-5 bg-yellow text-navy text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Best value</span>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-sans font-semibold text-base">Monthly membership</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className={`font-sans text-xs line-through ${selectedPlan === 'subscription' ? 'text-navy/40' : 'text-cream/25'}`}>${baseSub.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${subPrice}<span className="text-sm">/mo</span></span>
                        </span>
                      </div>
                      <p className={`font-sans text-sm ${selectedPlan === 'subscription' ? 'text-navy/60' : 'text-cream/40'}`}>Unlimited HeyDer dinners this month.</p>
                    </motion.button>
                  </motion.div>

                  {/* Coupon entry — matches Quiz.jsx's signup-flow version,
                      just missing here before this fix. */}
                  <div className="mb-4">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5">
                        <span className="font-sans text-emerald-400 text-xs">
                          ✓ Code <span className="font-mono">{appliedCoupon.code}</span> applied — {appliedCoupon.discountPercent}% off
                        </span>
                        <button type="button" onClick={removeCoupon} className="font-sans text-cream/40 hover:text-cream text-xs transition-colors">Remove</button>
                      </div>
                    ) : (
                      <div>
                        <label className="font-sans text-cream/40 text-xs tracking-[0.1em] uppercase mb-1.5 block">Coupon code</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                            placeholder="Enter code"
                            className="quiz-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            disabled={validatingCoupon || !couponInput.trim()}
                            className="btn-outline text-xs px-4 disabled:opacity-50"
                          >
                            {validatingCoupon ? '...' : 'Apply'}
                          </button>
                        </div>
                        {couponError && <p className="font-sans text-red-400/80 text-xs mt-1.5">{couponError}</p>}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handlePayment(selectedPlan)}
                    disabled={submitting}
                    className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting
                      ? 'Processing...'
                      : !stripeConfigured
                        ? 'Complete Booking (Test Mode)'
                        : selectedPlan === 'subscription' ? `Subscribe $${subPrice}/mo` : `Pay $${oneTimePrice} & Complete Booking`}
                  </button>
                </div>
                );
              })()}
            </div>
            <button onClick={() => setStep('date')} className="font-sans text-cream/50 hover:text-cream text-sm px-2 py-3 transition-colors">
              ← Back
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
