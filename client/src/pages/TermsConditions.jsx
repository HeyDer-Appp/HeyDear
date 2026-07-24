import React from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-navy">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="font-serif text-5xl text-cream mb-8">Terms & Conditions</h1>
        <div className="prose prose-invert font-sans space-y-6 text-cream/70 leading-relaxed">
          <p>Last updated: June 2026</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Booking & Payments</h2>
          <p>A $5 booking fee is required to reserve your spot at a HeyDer dinner. Food and beverages are paid separately at the restaurant on the night.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Cancellations & Refunds</h2>
          <p>Cancellations made at least 48 hours before the dinner are eligible for a full refund of the booking fee. Refunds are processed within 2-3 working days. Late cancellations are non-refundable.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Eligibility</h2>
          <p>HeyDer is open to adults aged 18 and over. We reserve the right to decline bookings at our discretion.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Matching</h2>
          <p>HeyDer makes its best efforts to create compatible groups based on your profile answers. We cannot guarantee specific outcomes or that all attendees will form lasting connections.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Behaviour</h2>
          <p>Attendees are expected to treat others with respect. HeyDer reserves the right to remove anyone from the programme for inappropriate behaviour.</p>
          <h2 className="font-serif text-2xl text-cream mt-8">Contact</h2>
          <p>Questions? Email <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow">info@heyder.nz</a></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
