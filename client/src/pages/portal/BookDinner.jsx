import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
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
  const [answers, setAnswers] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [dateChoices, setDateChoices] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [step, setStep] = useState('date');
  const [submitting, setSubmitting] = useState(false);

  const stripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  useEffect(() => {
    Promise.all([
      api.get('/portal/full-profile'),
      api.get('/profile/questions'),
    ]).then(([profileRes, questionsRes]) => {
      const { locked, hasActiveSubscription: hasSub, photo, answers: savedAnswers, profileComplete } = profileRes.data;
      if (!profileComplete) {
        // Nothing built yet — this page has nothing to work with.
        navigate('/profile', { replace: true });
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

  const submitBooking = async (fullAnswers) => {
    try {
      await api.post('/profile/submit', {
        ...fullAnswers,
        field_OVB7lzEjSl7C: fullAnswers.field_OVB7lzEjSl7C || [],
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
        await submitBooking(fullAnswers);
        return;
      }
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      const res = await api.post('/payments/create-checkout', {
        email: attendeeUser?.email,
        plan,
        metadata: { quizData: JSON.stringify(fullAnswers) },
      });
      sessionStorage.setItem('heyder_quiz_answers', JSON.stringify(fullAnswers));
      await stripe.redirectToCheckout({ sessionId: res.data.sessionId });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment setup failed. Please try again.');
      setSubmitting(false);
    }
  };

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
              <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="flex flex-wrap gap-2">
                {dateChoices.map(choice => (
                  <motion.button
                    key={choice}
                    variants={fadeLeftVariant}
                    type="button"
                    onClick={() => setSelectedDate(choice)}
                    className={`${choiceBase} ${selectedDate === choice ? choiceActive : choiceIdle}`}
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
              Continue to payment →
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
              ) : (
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
                        <span className="font-serif text-2xl">$10</span>
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
                        <span className="font-serif text-2xl">$15<span className="text-sm">/mo</span></span>
                      </div>
                      <p className={`font-sans text-sm ${selectedPlan === 'subscription' ? 'text-navy/60' : 'text-cream/40'}`}>Unlimited HeyDer dinners this month.</p>
                    </motion.button>
                  </motion.div>
                  <button
                    onClick={() => handlePayment(selectedPlan)}
                    disabled={submitting}
                    className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting
                      ? 'Processing...'
                      : !stripeConfigured
                        ? 'Complete Booking (Test Mode)'
                        : selectedPlan === 'subscription' ? 'Subscribe $15/mo' : 'Pay $10 & Complete Booking'}
                  </button>
                </div>
              )}
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
