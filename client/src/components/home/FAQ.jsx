import React, { useState } from 'react';

const faqs = [
  {
    q: 'What is included in Heyder?',
    a: 'When you book with us we do the matching, allocate the restaurant, and plan the menu. All you need to do is show up and have fun. Food and drinks you pay at the venue.',
  },
  {
    q: 'Who can use Heyder?',
    a: 'Adults 18+ who want to meet new people and make new friends; regardless of age, gender, orientation or background.',
  },
  {
    q: 'How much is the booking fee?',
    a: 'A $5 booking fee to grab your spot.',
  },
  {
    q: 'How to book?',
    a: 'Simply build your profile and let us do the magic. Choose which night suits you and we will let you know once we have found a group for you.',
  },
  {
    q: 'How are the groups assigned?',
    a: "We don't match you with people like you. We match you with people who would enjoy you. Your profile helps us understand who you are and what you are seeking. Our matching framework does the rest.",
  },
  {
    q: 'What is the surprise at the dinner?',
    a: 'Every dinner has two rituals that helps you connect through sharing and laughter. At end you can get a chance to choose the group reward.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellations should be notified at least 48hrs before the booking time. Refunds usually take 2-3 working days.',
  },
  {
    q: 'What if I have allergies?',
    a: "Our restaurant partners cater to allergen needs and are informed of any dietary requirements. We'll share the menu a day prior. Get in touch with us or the restaurant for any specific info.",
  },
  {
    q: 'When do dinners happen?',
    a: "Every Tuesday at 7pm across different venues in Auckland. Choose your preferred date and we'll confirm you the venue and group details.",
  },
  {
    q: 'What would the food cost at the restaurant?',
    a: 'Priced as per your budget — $45-$50 or $50-$55. Whatever you choose, you are meant to have a good time.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/8">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-5 flex items-center justify-between gap-4 group"
      >
        <span className="font-sans text-cream font-medium text-base leading-snug group-hover:text-gold transition-colors">
          {q}
        </span>
        <span className={`flex-shrink-0 w-6 h-6 rounded-full border border-gold/40 flex items-center justify-center transition-transform ${open ? 'rotate-45' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#E8A854" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <div className={`faq-answer ${open ? 'open' : ''}`}>
        <p className="font-sans text-cream/60 text-sm leading-relaxed pb-5 pr-10">{a}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <section id="faq" className="py-20 px-6 bg-deep-card/20">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">FAQ</span>
          <h2 className="section-title">
            Questions answered,<br />
            <em className="text-gold not-italic">honestly.</em>
          </h2>
        </div>
        <div>
          {faqs.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="font-sans text-cream/50 text-sm">
            Still have questions?{' '}
            <a href="mailto:info@heyder.nz" className="text-gold hover:text-yellow transition-colors">
              info@heyder.nz
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
