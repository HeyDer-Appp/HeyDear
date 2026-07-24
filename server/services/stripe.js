const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const ONE_TIME_AMOUNT = parseInt(process.env.STRIPE_ONE_TIME_AMOUNT) || 1000; // $10 NZD
const SUBSCRIPTION_AMOUNT = parseInt(process.env.STRIPE_SUBSCRIPTION_AMOUNT) || 1500; // $15 NZD/month

async function createCheckoutSession({ plan, userId, email, successUrl, cancelUrl, metadata = {} }) {
  const currency = process.env.STRIPE_CURRENCY || 'nzd';

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
            unit_amount: SUBSCRIPTION_AMOUNT,
          },
          quantity: 1,
        },
      ],
      metadata: { userId, plan: 'subscription', ...metadata },
      subscription_data: { metadata: { userId, ...metadata } },
      success_url: successUrl,
      cancel_url: cancelUrl,
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
          unit_amount: ONE_TIME_AMOUNT,
        },
        quantity: 1,
      },
    ],
    metadata: { userId, plan: 'one_time', ...metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
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
  ONE_TIME_AMOUNT,
  SUBSCRIPTION_AMOUNT,
};
