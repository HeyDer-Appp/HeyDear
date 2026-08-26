const { admin, db } = require('../firebase');

// Single doc, not a collection — there's only ever one active price list.
// Falls back to the env-var defaults (same values that used to be
// hardcoded in stripe.js) until an admin actually saves a price from the
// admin panel, so a fresh deploy with no Firestore doc yet still works.
const PRICING_DOC = () => db.collection('settings').doc('pricing');

const DEFAULTS = {
  oneTimeAmount: parseInt(process.env.STRIPE_ONE_TIME_AMOUNT) || 1000,
  subscriptionAmount: parseInt(process.env.STRIPE_SUBSCRIPTION_AMOUNT) || 1500,
  currency: process.env.STRIPE_CURRENCY || 'nzd',
};

async function getPricing() {
  const snap = await PRICING_DOC().get();
  if (!snap.exists) return { ...DEFAULTS };
  const data = snap.data();
  return {
    oneTimeAmount: Number.isFinite(data.oneTimeAmount) ? data.oneTimeAmount : DEFAULTS.oneTimeAmount,
    subscriptionAmount: Number.isFinite(data.subscriptionAmount) ? data.subscriptionAmount : DEFAULTS.subscriptionAmount,
    currency: data.currency || DEFAULTS.currency,
  };
}

async function setPricing({ oneTimeAmount, subscriptionAmount }) {
  await PRICING_DOC().set({
    oneTimeAmount,
    subscriptionAmount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return getPricing();
}

module.exports = { getPricing, setPricing, DEFAULTS };
