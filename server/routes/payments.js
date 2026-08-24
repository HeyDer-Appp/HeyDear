const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { createCheckoutSession, constructWebhookEvent } = require('../services/stripe');

// The incentive for paying immediately at signup instead of hitting "Skip
// for now" — applied automatically when nobody typed a coupon code, only in
// the signup context (not on later per-dinner bookings via BookDinner.jsx).
const SIGNUP_INSTANT_PAY_DISCOUNT_PERCENT = 10;

async function lookupCoupon(code) {
  if (!code) return null;
  const snap = await db.collection('coupons').doc(String(code).trim().toUpperCase()).get();
  if (!snap.exists) return null;
  const c = snap.data();
  if (c.active === false) return null;
  if (c.expiresAt && c.expiresAt.toDate() < new Date()) return null;
  return { code: snap.id, discountPercent: c.discountPercent };
}

// Lets the payment screen validate/preview a code (and show the discounted
// price) before the attendee actually commits to checkout.
router.post('/validate-coupon', async (req, res) => {
  try {
    const coupon = await lookupCoupon(req.body.code);
    if (!coupon) return res.status(404).json({ valid: false, error: 'That code is invalid or has expired.' });
    res.json({ valid: true, code: coupon.code, discountPercent: coupon.discountPercent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/create-checkout', async (req, res) => {
  try {
    const { email, tempUserId, plan, couponCode, context } = req.body;
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // A coupon always wins over the automatic signup incentive rather than
    // stacking with it — keeps "what discount did I actually get" simple to
    // reason about both for attendees and for us reading payment records.
    let discountPercent = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await lookupCoupon(couponCode);
      if (!coupon) return res.status(400).json({ error: 'That coupon code is invalid or has expired.' });
      discountPercent = coupon.discountPercent;
      appliedCoupon = coupon.code;
    } else if (context === 'signup') {
      discountPercent = SIGNUP_INSTANT_PAY_DISCOUNT_PERCENT;
    }

    const session = await createCheckoutSession({
      plan: plan === 'subscription' ? 'subscription' : 'one_time',
      userId: tempUserId || 'pending',
      email,
      discountPercent,
      successUrl: `${baseUrl}/profile/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/profile?step=payment&cancelled=true`,
      metadata: { email, ...(appliedCoupon ? { couponCode: appliedCoupon } : {}) },
    });

    res.json({ sessionId: session.id, url: session.url, discountPercent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = await constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId } = session.metadata || {};

      if (userId && userId !== 'pending' && session.mode === 'payment') {
        await db.collection('payments').doc(session.id).set({
          userId,
          stripePaymentIntentId: session.payment_intent,
          amount: session.amount_total,
          currency: session.currency || 'nzd',
          status: 'completed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      // Subscription-mode sessions are reconciled in POST /api/profile/submit,
      // which has the real user id at hand. Lifecycle updates from here on
      // are keyed by the Stripe subscription id, which is already linked by then.
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await db.collection('subscriptions').doc(sub.id).set({
        status: sub.status,
        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch (dbErr) {
    console.error('DB error on webhook:', dbErr);
  }

  res.json({ received: true });
});

router.get('/verify/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const snap = await db.collection('payments').doc(sessionId).get();
    if (snap.exists) {
      return res.json({ paid: snap.data().status === 'completed' });
    }
    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json({ paid: session.payment_status === 'paid', session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

module.exports = router;
