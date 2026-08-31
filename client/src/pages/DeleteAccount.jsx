import React from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="font-serif text-5xl text-cream mb-8">Delete your HeyDer account</h1>
        <div className="prose prose-invert font-sans space-y-6 text-cream/70 leading-relaxed">
          <h2 className="font-serif text-2xl text-cream mt-8">Option 1 — delete it yourself in the app</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open the HeyDer app and sign in</li>
            <li>Go to your <strong>Profile</strong> tab</li>
            <li>Tap the <strong>settings icon</strong> (⚙️) in the top right</li>
            <li>Tap <strong>Delete account</strong></li>
            <li>Type <strong>DELETE</strong> to confirm</li>
          </ol>
          <p>This deletes your account immediately.</p>

          <h2 className="font-serif text-2xl text-cream mt-8">Option 2 — request it by email</h2>
          <p>
            Don't have the app installed anymore? Email <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a> from
            the address your HeyDer account is registered under, with the subject "Delete my account." We'll process it within 7 days.
          </p>

          <h2 className="font-serif text-2xl text-cream mt-8">What gets deleted</h2>
          <p>Deleting your account permanently removes your profile, quiz answers, photos, bookings, table matches, group chat and direct messages, and cancels any active subscription.</p>

          <h2 className="font-serif text-2xl text-cream mt-8">What we keep</h2>
          <p>Completed payment records are retained as required by NZ tax law, and are handled by Stripe, our payment processor — HeyDer does not store card numbers. Messages you sent inside a shared group chat remain visible to the other members of that table, since it's their conversation too, but are no longer linked to your name or profile once your account is deleted.</p>

          <h2 className="font-serif text-2xl text-cream mt-8">Contact</h2>
          <p>Questions about account deletion? Email <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
