import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import api from '../utils/api';

const STEPS = [
  'Members sign up and choose which Tuesday suits them best.',
  'We match and send them in groups of 6 to different restaurants.',
  'They eat, chat, and then head over to another location for an AfterParty.',
];

const RESTAURANT_PERKS = [
  {
    title: 'Make Tuesdays not so quiet',
    body: "We'll send you around 6–12 people on a Tuesday night. No commission — we send you people, you provide the hospitality.",
  },
  {
    title: 'Predictable sales',
    body: 'A minimum spend of $50pp for food, plus drinks on top.',
  },
  {
    title: 'Showcase what you\'ve got',
    body: 'You curate a set menu you think suits best. The only thing the group orders separately is drinks.',
  },
];

const VENUE_PERKS = [
  {
    title: '20–50 social people',
    body: 'People who just want a fun night out and to spend some time mingling around.',
  },
  {
    title: 'Curate your experience',
    body: "Whether you're a bar, arcade, bowling alley, or something else — we'll work with you to bring members through your door.",
  },
  {
    title: 'Social presence',
    body: 'We regularly bring social media creators to our experiences — a chance to showcase your services and venue.',
  },
];

const VENUE_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'venue', label: 'Venue' },
  { value: 'other', label: 'Other' },
];

const inputLabel = 'font-sans text-cream/50 text-xs uppercase tracking-widest mb-1.5 block';

export default function PartnerWithUs() {
  const [form, setForm] = useState({ name: '', establishmentName: '', venueType: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/partners', form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy">
      <Navbar />

      {/* Hero */}
      <section className="quiz-bg pt-40 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">HeyDer for partners</span>
          <h1 className="section-title">
            You handle the experience.<br />
            We bring you <em className="text-gold not-italic">the people.</em>
          </h1>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 px-6 bg-deep-card border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-center font-sans text-cream/40 text-xs tracking-widest uppercase mb-8">Since June 2026</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-serif text-4xl text-gold">500+</p>
              <p className="font-sans text-cream/50 text-sm mt-1">diners sent to restaurants</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-gold">$50,000+</p>
              <p className="font-sans text-cream/50 text-sm mt-1">revenue generated across partners</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-gold">25+</p>
              <p className="font-sans text-cream/50 text-sm mt-1">partners in Auckland &amp; Wellington</p>
            </div>
          </div>
        </div>
      </section>

      {/* For */}
      <section className="section text-center">
        <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-5 block">For</span>
        <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
          <span className="inline-block font-sans text-xs uppercase tracking-widest font-semibold text-navy bg-gold rounded-full px-5 py-2">Restaurants</span>
          <span className="inline-block font-sans text-xs uppercase tracking-widest font-semibold text-navy bg-gold rounded-full px-5 py-2">Bars &amp; Venues</span>
        </div>
        <p className="font-sans text-cream/60 max-w-xl mx-auto leading-relaxed">
          HeyDer brings curated groups of strangers to your restaurant or venue on Tuesdays.
        </p>
      </section>

      {/* What we do */}
      <section className="section">
        <h2 className="section-title mb-4">But what do we even do?</h2>
        <p className="font-sans text-cream/60 max-w-2xl mb-10 leading-relaxed">
          We send people to have dinner with complete strangers, then send them on to an AfterParty experience.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div key={i} className="card">
              <p className="font-serif text-3xl text-gold mb-3">{i + 1}</p>
              <p className="font-sans text-cream/70 text-sm leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Perks */}
      <section className="section grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        <div>
          <h3 className="font-serif text-2xl text-cream mb-6">What's in it for restaurants</h3>
          <div className="space-y-6">
            {RESTAURANT_PERKS.map((p) => (
              <div key={p.title}>
                <p className="font-sans font-semibold text-cream text-sm mb-1">{p.title}</p>
                <p className="font-sans text-cream/50 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-serif text-2xl text-cream mb-6">What's in it for bars &amp; venues</h3>
          <div className="space-y-6">
            {VENUE_PERKS.map((p) => (
              <div key={p.title}>
                <p className="font-sans font-semibold text-cream text-sm mb-1">{p.title}</p>
                <p className="font-sans text-cream/50 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="apply" className="section max-w-lg">
        <h2 className="section-title mb-2">Let's talk.</h2>
        <p className="font-sans text-cream/50 mb-8">Fill in a few details and we'll be in touch with you.</p>

        {submitted ? (
          <div className="card text-center py-12">
            <p className="text-3xl mb-3">🎉</p>
            <p className="font-serif text-xl text-cream mb-2">Thanks — we'll be in touch.</p>
            <p className="font-sans text-cream/50 text-sm">Our team will reach out shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            <div>
              <label className={inputLabel}>Name</label>
              <input
                type="text" required value={form.name}
                onChange={e => setField('name', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className={inputLabel}>Name of your establishment</label>
              <input
                type="text" required value={form.establishmentName}
                onChange={e => setField('establishmentName', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className={inputLabel}>We are</label>
              <select
                required value={form.venueType}
                onChange={e => setField('venueType', e.target.value)}
                className="input-field"
              >
                <option value="" disabled className="bg-navy text-cream/40">Select one</option>
                {VENUE_TYPES.map(t => (
                  <option key={t.value} value={t.value} className="bg-navy text-cream">{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={inputLabel}>Contact number</label>
              <input
                type="tel" required value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className={inputLabel}>Email</label>
              <input
                type="email" required value={form.email}
                onChange={e => setField('email', e.target.value)}
                className="input-field"
              />
            </div>

            {error && <p className="font-sans text-red-400 text-sm">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
              {submitting ? 'Sending...' : 'Submit'}
            </button>
          </form>
        )}
      </section>

      <Footer />
    </div>
  );
}
