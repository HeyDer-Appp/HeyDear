import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// Stripe Checkout, opened without ever leaving the app. In the native build,
// a plain `window.location.href` to a checkout.stripe.com URL gets kicked out
// to the phone's system browser (Capacitor's default for any origin outside
// capacitor.config.json's server.url) — jarring, and the whole reason the
// appStateChange/pending-session-id dance exists in App.jsx. @capacitor/browser
// instead opens it as an in-app sheet (SFSafariViewController on iOS, Chrome
// Custom Tabs on Android) that stays visually part of the app and can be
// dismissed, or closed programmatically, without ever backgrounding HeyDer.
// In the browser (not the native app), this is just a normal redirect.
export async function openCheckout(url) {
  if (!Capacitor.isNativePlatform()) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

// Stripe's successUrl/cancelUrl both point back at this app's own origin
// (see server/routes/payments.js), so the sheet itself shows the result —
// the user sees "payment successful" right there, still inside the app's
// own sheet, and taps the native Done/back control to dismiss it. The
// Browser plugin only exposes the *initial* page load and a close event
// (no per-navigation URL, so there's no way to auto-close the moment Stripe
// redirects to successUrl) — 'browserFinished' is what fires on that tap,
// and is the cue to re-check the booking the same way App.jsx's old
// appStateChange fallback already does via heyder_pending_session_id.
export function onCheckoutClosed(callback) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listenerPromise = Browser.addListener('browserFinished', callback);
  return () => { listenerPromise.then((l) => l.remove()); };
}
