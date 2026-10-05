import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { openCheckout } from '../../utils/checkout';
import { fadeUpVariant, staggerContainerVariant, fadeLeftVariant, choiceBase } from '../Quiz';
import BottomNav from '../../components/BottomNav';

// Booking again is just "pick a Tuesday, pay (or not, if subscribed)" — a
// returning member's profile is already built, so this is a dedicated,
// two-step page rather than sending them back through the profile quiz.
const choiceIdle = 'border-transparent bg-navy/[0.05] text-navy/70 hover:bg-navy/[0.09] hover:text-navy';
const choiceActive = 'border-plum bg-plum text-cream shadow-[0_6px_20px_rgba(117,68,113,0.25)]';

export default function BookDinner() {
  const { attendeeUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const presetDate = location.state?.presetDate;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [answers, setAnswers] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [dateChoices, setDateChoices] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [step, setStep] = useState('date');
  // True once we've auto-jumped straight to payment because a date was
  // already picked on the My Table sentence card — "date" here would be an
  // unfamiliar, differently-styled screen the person never actually chose
  // to use, so Back should return to that card instead of surfacing it.
  const [skippedDateStep, setSkippedDateStep] = useState(false);
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
    window.addEventListener('heyder:checkoutClosed', onVisible);
    checkPendingPayment();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('heyder:checkoutClosed', onVisible);
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
      const choices = dateQuestion?.choices || [];
      setDateChoices(choices);

      // Came here already having picked a date on the My Table sentence
      // card — skip straight to the plan choice instead of asking again,
      // as long as the server's own date list actually has that date.
      if (presetDate && choices.includes(presetDate)) {
        setSelectedDate(presetDate);
        setStep('payment');
        setSkippedDateStep(true);
      }
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      openCheckout(res.data.url);
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
    <nav
      className="relative z-10 flex items-center justify-between px-6 pb-5 border-b border-navy/10"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <Link to="/portal/dashboard" className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (alreadyBooked) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="text-4xl mb-4">🍽</p>
          <p className="font-serif text-2xl text-navy mb-3">Already booked</p>
          <p className="font-sans text-navy/65 text-sm mb-6 leading-relaxed">
            One Tuesday at a time. Cancel it from My Table to pick another.
          </p>
          <Link to="/portal/dashboard" className="plum-cta text-sm py-2.5 px-6">Back</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <h1 className="font-serif font-bold text-3xl text-navy">
          {step === 'date' ? 'Which Tuesday?' : 'Your spot'}
        </h1>

        {step === 'date' && (
          <>
            <div className="glass-card">
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
              className="plum-cta w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {hasActiveSubscription ? 'Confirm →' : 'Continue to payment →'}
            </button>
          </>
        )}

        {step === 'payment' && (
          <>
            <div className="glass-card">
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif font-bold text-xl text-navy mb-4 flex items-center gap-2">
                {selectedDate}
                {!stripeConfigured && (
                  <span className="text-[10px] font-sans font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-plum/15 text-plum">Test</span>
                )}
              </motion.p>

              {hasActiveSubscription ? (
                <div>
                  <div className="rounded-xl border border-plum/25 bg-plum/[0.06] p-4 mb-4 text-center">
                    <p className="font-sans text-navy/80 text-sm">✓ Covered by your membership</p>
                  </div>
                  <button
                    onClick={handleConfirmSubscribed}
                    disabled={submitting}
                    className="plum-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? 'Confirming...' : 'Confirm'}
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
                        <span className="font-sans font-semibold text-base">One dinner</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className={`font-sans text-xs line-through ${selectedPlan === 'one_time' ? 'text-cream/60' : 'text-navy/40'}`}>${baseOneTime.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${oneTimePrice}</span>
                        </span>
                      </div>
                      <p className={`font-sans text-sm ${selectedPlan === 'one_time' ? 'text-cream/80' : 'text-navy/55'}`}>Refundable up to 48h before.</p>
                    </motion.button>
                    <motion.button
                      variants={fadeLeftVariant}
                      type="button"
                      onClick={() => setSelectedPlan('subscription')}
                      className={`w-full text-left rounded-2xl border p-4 transition-colors duration-200 relative ${selectedPlan === 'subscription' ? choiceActive : choiceIdle}`}
                    >
                      <span className="absolute -top-2.5 right-5 bg-plum text-cream text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Best value</span>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-sans font-semibold text-base">Monthly</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className={`font-sans text-xs line-through ${selectedPlan === 'subscription' ? 'text-cream/60' : 'text-navy/40'}`}>${baseSub.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${subPrice}<span className="text-sm">/mo</span></span>
                        </span>
                      </div>
                      <p className={`font-sans text-sm ${selectedPlan === 'subscription' ? 'text-cream/80' : 'text-navy/55'}`}>Unlimited dinners.</p>
                    </motion.button>
                  </motion.div>

                  {/* Coupon entry — matches Quiz.jsx's signup-flow version,
                      just missing here before this fix. */}
                  <div className="mb-4">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2.5">
                        <span className="font-sans text-emerald-700 text-xs">
                          ✓ <span className="font-mono">{appliedCoupon.code}</span> · {appliedCoupon.discountPercent}% off
                        </span>
                        <button type="button" onClick={removeCoupon} className="font-sans text-navy/55 hover:text-navy text-xs transition-colors">Remove</button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                            placeholder="Coupon code"
                            className="portal-login-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            disabled={validatingCoupon || !couponInput.trim()}
                            className="plum-cta text-xs px-5 py-2 disabled:opacity-50"
                          >
                            {validatingCoupon ? '...' : 'Apply'}
                          </button>
                        </div>
                        {couponError && <p className="font-sans text-red-700/80 text-xs mt-1.5">{couponError}</p>}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handlePayment(selectedPlan)}
                    disabled={submitting}
                    className="plum-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting
                      ? 'Processing...'
                      : !stripeConfigured
                        ? 'Book (test)'
                        : selectedPlan === 'subscription' ? `Subscribe $${subPrice}/mo` : `Pay $${oneTimePrice}`}
                  </button>
                </div>
                );
              })()}
            </div>
            <button
              onClick={() => skippedDateStep ? navigate('/portal/dashboard') : setStep('date')}
              className="font-sans text-navy/65 hover:text-navy text-sm px-2 py-3 transition-colors"
            >
              ← Back
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
