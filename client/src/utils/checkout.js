import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// The one entry point for paying. The server returns a clientSecret when asked
// for an embedded session ({ embedded: true }) — then Stripe Checkout opens
// inside the app itself (components/CheckoutHost): no browser, no new window,
// same signed-in session, on web, iOS and Android alike. Without a clientSecret
// (an older server, or no publishable key to render with) it falls back to the
// hosted page, below.
export function startCheckout(data) {
  if (data && data.clientSecret && import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    window.dispatchEvent(new CustomEvent('heyder:openCheckout', { detail: { clientSecret: data.clientSecret } }));
    return Promise.resolve();
  }
  return openCheckout(data && data.url);
}

// A Stripe-hosted page (the hosted-checkout fallback, and the billing portal,
// which can't be embedded). In the native build a plain `window.location.href`
// to a stripe.com URL gets kicked out to the phone's system browser (Capacitor's
// default for any origin outside capacitor.config.json's server.url), so this
// opens @capacitor/browser's in-app sheet instead (SFSafariViewController on iOS,
// Chrome Custom Tabs on Android). In a normal browser it's just a redirect.
export async function openCheckout(url) {
  if (!Capacitor.isNativePlatform()) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}
