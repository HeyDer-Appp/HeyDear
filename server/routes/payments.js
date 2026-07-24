const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { createCheckoutSession, constructWebhookEvent } = require('../services/stripe');

router.post('/create-checkout', async (req, res) => {
  try {
    const { email, tempUserId, plan } = req.body;
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    const session = await createCheckoutSession({
      plan: plan === 'subscription' ? 'subscription' : 'one_time',
      userId: tempUserId || 'pending',
      email,
      successUrl: `${baseUrl}/profile/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/profile?step=payment&cancelled=true`,
      metadata: { email },
    });

    res.json({ sessionId: session.id, url: session.url });
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
