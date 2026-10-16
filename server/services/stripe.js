const Stripe = require('stripe');
const { DEFAULTS: PRICING_DEFAULTS } = require('./pricing');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// A flat % off the listed price — same knock-down applied whether it comes
// from an ambassador coupon or the automatic "pay now" signup incentive, the
// caller decides which (if either) applies and passes the resulting number
// in. For a subscription this discounts every renewal, not just the first
// month — there's no Stripe Coupon/PromotionCode object involved, just a
// smaller unit_amount baked into the price_data up front.
function discountedAmount(amount, discountPercent) {
  if (!discountPercent) return amount;
  return Math.max(0, Math.round(amount * (1 - discountPercent / 100)));
}

// oneTimeAmount/subscriptionAmount are the live, admin-editable prices
// (server/services/pricing.js) — callers fetch those and pass them in
// rather than this module reading a value fixed at process start, so a
// price change from the admin panel takes effect on the very next checkout.
// embedded: true renders Checkout inside the app's own page (Stripe's Embedded
// Checkout) instead of sending the person to a stripe.com page — in the native
// app that page would open in the phone's browser, a different session from
// the app. It needs a returnUrl (only used if a payment method has to redirect
// away and back) instead of success/cancel URLs.
async function createCheckoutSession({
  plan, userId, email, successUrl, cancelUrl, returnUrl, embedded = false, metadata = {}, discountPercent = 0,
  oneTimeAmount = PRICING_DEFAULTS.oneTimeAmount, subscriptionAmount = PRICING_DEFAULTS.subscriptionAmount,
}) {
  const currency = process.env.STRIPE_CURRENCY || 'nzd';
  const where = embedded
    ? { ui_mode: 'embedded', return_url: returnUrl, redirect_on_completion: 'if_required' }
    : { success_url: successUrl, cancel_url: cancelUrl };

  if (plan === 'subscription') {
    return stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            recurring: { interval: 'month' },
            product_data: {
              name: 'HeyDer Monthly Membership',
              description: 'Unlimited HeyDer Tuesday dinners — renews monthly, cancel anytime.',
              images: ['https://heyder.nz/wp-content/uploads/2026/04/logo1.png'],
            },
            unit_amount: discountedAmount(subscriptionAmount, discountPercent),
          },
          quantity: 1,
        },
      ],
      metadata: { userId, plan: 'subscription', ...metadata },
      subscription_data: { metadata: { userId, ...metadata } },
      ...where,
    });
  }

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: 'HeyDer Dinner Reservation',
            description: 'One-time reservation for a HeyDer Tuesday dinner.',
            images: ['https://heyder.nz/wp-content/uploads/2026/04/logo1.png'],
          },
          unit_amount: discountedAmount(oneTimeAmount, discountPercent),
        },
        quantity: 1,
      },
    ],
    metadata: { userId, plan: 'one_time', ...metadata },
    ...where,
  });
}

async function constructWebhookEvent(payload, signature) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

async function getPaymentIntent(paymentIntentId) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

async function getCheckoutSession(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
}

module.exports = {
  stripe,
  createCheckoutSession,
  constructWebhookEvent,
  getPaymentIntent,
  getCheckoutSession,
};
