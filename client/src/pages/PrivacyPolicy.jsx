import React from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="font-serif text-5xl text-cream mb-8">Privacy Policy</h1>
        <div className="prose prose-invert font-sans space-y-6 text-cream/70 leading-relaxed">
          <p>Last updated: June 2026</p>
          <h2 className="font-serif text-2xl text-cream mt-8">What we collect</h2>
          <p>When you sign up for HeyDer, we collect your name, email, phone number, date of birth, gender, country of origin, and your profile answers. This information is used solely to match you with a compatible dinner group.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">How we use it</h2>
          <p>Your information is used to create curated dinner groups, send you event-related emails, and improve our matching algorithm. We do not sell your personal data to third parties.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Payment information</h2>
          <p>All payments are processed securely through Stripe. We do not store credit card numbers on our servers.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Data retention</h2>
          <p>We retain your data for as long as you have an active account. You may request deletion at any time by emailing info@heyder.nz.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Contact</h2>
          <p>For any privacy concerns, email us at <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
