import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { tap } from '../utils/haptics';

// Stripe Checkout, shown right inside the app as a full-screen sheet — no
// browser, no new window, same signed-in session. Anything can open it by
// calling startCheckout() (utils/checkout.js), which hands over the session's
// client secret through a window event; nothing here knows which screen asked.
//
// When the sheet ends, the screen that started the payment is told through
// 'heyder:checkoutClosed' (paid — it verifies and moves on) or
// 'heyder:checkoutCancelled' (backed out — it un-sticks its "Processing…" button).
export default function CheckoutHost() {
  const [secret, setSecret] = useState(null);
  const stripePromise = useMemo(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  useEffect(() => {
    const open = (e) => setSecret(e.detail && e.detail.clientSecret ? e.detail.clientSecret : null);
    window.addEventListener('heyder:openCheckout', open);
    return () => window.removeEventListener('heyder:openCheckout', open);
  }, []);

  // Keep the page behind from scrolling while paying.
  useEffect(() => {
    if (!secret) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [secret]);

  const finished = useCallback(() => {
    setSecret(null);
    window.dispatchEvent(new Event('heyder:checkoutClosed'));
  }, []);
  const cancelled = useCallback(() => {
    tap();
    setSecret(null);
    window.dispatchEvent(new Event('heyder:checkoutCancelled'));
  }, []);

  const options = useMemo(() => (secret ? { clientSecret: secret, onComplete: finished } : null), [secret, finished]);
  if (!secret || !stripePromise || !options) return null;

  return (
    <div
      data-no-ptr
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: '#E7DFC5', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <p className="font-serif font-bold text-lg text-navy">Payment</p>
        <button onClick={cancelled} aria-label="Cancel payment" className="font-sans text-sm text-navy/60 hover:text-navy px-2 py-1">Cancel</button>
      </div>
      <div className="flex-1 overflow-y-auto px-3" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', WebkitOverflowScrolling: 'touch' }}>
        <div className="rounded-2xl overflow-hidden bg-white max-w-lg mx-auto">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}
