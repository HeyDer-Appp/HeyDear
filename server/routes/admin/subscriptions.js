const express = require('express');
const router = express.Router();
const { db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const { stripe } = require('../../services/stripe');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// Every subscription record this app knows about, joined to the person it
// belongs to, plus a cross-check against Stripe itself: any real (non-
// simulated) subscription Stripe has that isn't one of our own docs is
// flagged as an "orphan" — exactly the failure mode that let a real
// payment go through with no record in the app (fixed going forward in
// payments.js, but this is how an admin would ever notice if it happened
// again, or for any subscription created before that fix shipped).
router.get('/', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('subscriptions').get();

    const subscriptions = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const userSnap = data.userId ? await db.collection('users').doc(data.userId).get() : null;
      const user = userSnap?.exists ? userSnap.data() : null;
      return {
        id: d.id,
        user_id: data.userId || null,
        first_name: user?.firstName || null,
        last_name: user?.lastName || null,
        email: user?.email || null,
        status: data.status || null,
        plan: data.plan || null,
        simulated: !!data.simulated,
        current_period_end: toDate(data.currentPeriodEnd)?.toISOString() || null,
        updated_at: toDate(data.updatedAt)?.toISOString() || null,
      };
    }));
    subscriptions.sort((a, b) => (b.current_period_end || '').localeCompare(a.current_period_end || ''));

    let orphans = [];
    try {
      const knownIds = new Set(snap.docs.map((d) => d.id));
      const stripeSubs = await stripe.subscriptions.list({ limit: 100, status: 'all' });
      orphans = stripeSubs.data
        .filter((s) => !knownIds.has(s.id))
        .map((s) => ({
          id: s.id,
          status: s.status,
          current_period_end: new Date(s.current_period_end * 1000).toISOString(),
          customer_email: s.metadata?.email || null,
          metadata_user_id: s.metadata?.userId || null,
        }));
    } catch (stripeErr) {
      console.error('Stripe orphan check failed:', stripeErr.message);
    }

    res.json({ subscriptions, orphans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
