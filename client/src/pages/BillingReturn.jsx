import React from 'react';

// Where Stripe's billing page sends people back to. It opens in a sheet
// outside the app's own session, so this page is public and just says so —
// closing the sheet returns to HeyDer.
export default function BillingReturn() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 text-center" style={{ background: '#E7DFC5' }}>
      <div>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-8 brightness-0 mx-auto mb-6" />
        <p className="font-serif font-bold text-2xl text-navy mb-2">All set ✓</p>
        <p className="font-sans text-navy/65 text-sm">Close this window to go back to HeyDer.</p>
      </div>
    </div>
  );
}
