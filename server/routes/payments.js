const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { createCheckoutSession, constructWebhookEvent, getCheckoutSession } = require('../services/stripe');
const { getPricing } = require('../services/pricing');
const { attendeeAuth } = require('../middleware/auth');

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
  return { code: snap.id, discountPercent: c.discountPercent, type: c.type || null };
}

// A coupon created for one purchase type shouldn't work on the other — an
// unrestricted coupon (no type set, e.g. an ambassador's code) passes either.
function couponMatchesPlan(coupon, normalizedPlan) {
  return !coupon.type || coupon.type === normalizedPlan;
}

// Lets the payment screen show the real, current price (set from the admin
// panel) instead of a number baked into the frontend build.
router.get('/pricing', async (req, res) => {
  try {
    res.json(await getPricing());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lets the payment screen validate/preview a code (and show the discounted
// price) before the attendee actually commits to checkout.
router.post('/validate-coupon', async (req, res) => {
  try {
    const coupon = await lookupCoupon(req.body.code);
    if (!coupon) return res.status(404).json({ valid: false, error: 'That code is invalid or has expired.' });
    if (req.body.plan) {
      const normalizedPlan = req.body.plan === 'subscription' ? 'subscription' : 'one_time';
      if (!couponMatchesPlan(coupon, normalizedPlan)) {
        return res.status(400).json({ valid: false, error: `That code only works for ${coupon.type === 'subscription' ? 'the monthly membership' : 'one-time reservations'}.` });
      }
    }
    res.json({ valid: true, code: coupon.code, discountPercent: coupon.discountPercent, type: coupon.type });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Requires being signed in — every caller (Quiz.jsx, BookDinner.jsx) only
// ever renders for an authenticated attendee anyway, and this is what makes
// the Stripe session's metadata.userId real instead of the literal string
// "pending" it used to be. Without a real userId here, the webhook has no
// way to reconcile a subscription on its own — it used to depend entirely
// on the client successfully calling /profile/submit after the redirect
// back from Stripe, which is not guaranteed (closed tab, crashed page,
// flaky network) and silently left a real charge with no subscription record.
router.post('/create-checkout', attendeeAuth, async (req, res) => {
  try {
    const { plan, couponCode, context } = req.body;
    const email = req.user.email;
    // A trailing slash on CLIENT_URL (easy to set by accident, and exactly
    // what was live in production) produces "https://host//profile/success"
    // — a double slash React Router doesn't match against the real route,
    // silently falling through to a catch-all instead of ever calling
    // /profile/submit. Stripped defensively so the env var's exact value
    // can't cause this again.
    const baseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

    // A coupon always wins over the automatic signup incentive rather than
    // stacking with it — keeps "what discount did I actually get" simple to
    // reason about both for attendees and for us reading payment records.
    const normalizedPlan = plan === 'subscription' ? 'subscription' : 'one_time';

    let discountPercent = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await lookupCoupon(couponCode);
      if (!coupon) return res.status(400).json({ error: 'That coupon code is invalid or has expired.' });
      if (!couponMatchesPlan(coupon, normalizedPlan)) {
        return res.status(400).json({ error: `That code only works for ${coupon.type === 'subscription' ? 'the monthly membership' : 'one-time reservations'}.` });
      }
      discountPercent = coupon.discountPercent;
      appliedCoupon = coupon.code;
    } else if (context === 'signup') {
      discountPercent = SIGNUP_INSTANT_PAY_DISCOUNT_PERCENT;
    }

    const pricing = await getPricing();

    const session = await createCheckoutSession({
      plan: normalizedPlan,
      userId: req.user.id,
      email,
      discountPercent,
      oneTimeAmount: pricing.oneTimeAmount,
      subscriptionAmount: pricing.subscriptionAmount,
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
      const { userId, couponCode } = session.metadata || {};

      // Record the redemption only once payment is actually confirmed (not
      // at checkout-session creation, since a user can abandon checkout
      // without paying). Stripe can redeliver the same webhook, so this
      // guards against double-counting with a transaction: the redemption
      // doc (keyed by session.id) only gets written, and the counter only
      // incremented, the first time this session is seen.
      if (couponCode && userId && userId !== 'pending') {
        const userSnap = await db.collection('users').doc(userId).get();
        const user = userSnap.data() || {};
        const couponRef = db.collection('coupons').doc(couponCode);
        const redemptionRef = couponRef.collection('redemptions').doc(session.id);
        await db.runTransaction(async (tx) => {
          const existing = await tx.get(redemptionRef);
          if (existing.exists) return;
          tx.set(redemptionRef, {
            userId,
            email: session.customer_details?.email || user.email || null,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
            plan: session.mode === 'subscription' ? 'subscription' : 'one_time',
            amount: session.amount_total,
            redeemedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          tx.set(couponRef, { redemptionCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
        });
      }

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

      // The subscription record is created here, not left to a client-side
      // call after the redirect back from Stripe — that path isn't
      // guaranteed to run (closed tab, crashed page, flaky network), and a
      // real charge with no subscription record is exactly the failure this
      // is meant to prevent. POST /profile/submit's own reconcile still
      // runs too when it does succeed — same doc id, harmless to write twice.
      if (userId && userId !== 'pending' && session.mode === 'subscription' && session.subscription) {
        const fullSession = await getCheckoutSession(session.id);
        const sub = fullSession.subscription;
        if (sub) {
          await db.collection('subscriptions').doc(sub.id).set({
            userId,
            stripeCustomerId: session.customer,
            plan: 'monthly',
            status: sub.status,
            currentPeriodEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }
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
