import React from 'react';
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_6_1f9e9.png',
    title: 'Sign Up',
    time: '5 minutes',
    body: 'Build your profile to help us understand you and the type of people you wish to meet. We handle the venue, the menu and find a compatible group who wanted to meet someone like you.',
  },
  {
    number: '02',
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_7_1f44b.png',
    title: 'Show Up',
    time: 'Every Tuesday',
    body: "Head to your assigned restaurant. Settle in and meet your people — it's okay to be nervous. Remember the best part is knowing they chose to be there for a purpose, just like you.",
  },
  {
    number: '03',
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_8_1f465.png',
    title: 'Socialise',
    time: 'Rituals + rewards',
    body: 'Expect fun, laughs and stories over a curated menu. Take part in a simple ritual that helps you connect — with a reward tied to the experience. Show up once, twice, find your people.',
  },
];

export default function HowItWorks() {
  return (
    <section id="works" className="py-20 px-6 bg-deep-card/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">How It Works</span>
          <h2 className="section-title">
            Three steps to<br />
            <em className="text-gold not-italic">real connection.</em>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-14 left-full w-full h-px bg-gradient-to-r from-gold/30 to-transparent z-10" />
              )}
              <div className="bg-dark-card rounded-2xl p-8 border border-white/5 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <span className="font-serif text-5xl text-gold/30 leading-none">{step.number}</span>
                  <img src={step.icon} alt={step.title} className="w-9 h-9" />
                </div>
                <h3 className="font-serif text-2xl text-cream mb-2">{step.title}</h3>
                <span className="inline-block font-sans text-xs text-gold tracking-wider uppercase font-semibold mb-4 bg-gold/10 px-3 py-1 rounded-full">
                  {step.time}
                </span>
                <p className="font-sans text-cream/55 text-sm leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link to="/profile" className="btn-primary">
            SIGN UP NOW
          </Link>
        </div>
      </div>
    </section>
  );
}
