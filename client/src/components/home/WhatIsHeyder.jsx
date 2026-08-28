import React from 'react';

const features = [
  {
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_2_1f3af.png',
    title: 'Curated Groups',
    body: 'HeyDer uses a behavioral framework to curate a right group so that matches are intentional and build an experience around people who would complement your personality.',
  },
  {
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_3_1f37d.png',
    title: 'Designed for bonding',
    body: 'The act of sharing food breaks barriers fast. You naturally pass dishes and start conversations without forced icebreakers or awkward introductions.',
  },
  {
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_4_1f381.png',
    title: 'Rituals that reward',
    body: 'Every HeyDer dinner includes a ritual that the whole table takes part in together. It\'s designed to bring everyone closer — and there\'s a real reward waiting on the other side of it.',
  },
];

export default function WhatIsHeyder() {
  return (
    <section id="about" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-16">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">What is HeyDer</span>
          <h2 className="section-title mb-6">
            Stop scrolling bios.<br />Start showing up where<br />
            <em className="text-gold not-italic">you belong.</em>
          </h2>
          <p className="font-sans text-cream/60 text-base leading-relaxed">
            You've been to social events. You've downloaded the apps. You've had the conversations that went nowhere and left wondering what's missing. What's missing isn't opportunity. It's knowing — before you walk in — that someone there actually wanted to meet you.
          </p>
          <p className="font-sans text-cream/60 text-base leading-relaxed mt-4">
            HeyDer exist to make that possible. To find you the right people — not just more people.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-dark-card rounded-2xl p-8 border border-white/5 hover:border-gold/20 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/30 transition-all duration-300 group"
            >
              <img src={f.icon} alt={f.title} className="w-10 h-10 mb-5" />
              <h3 className="font-serif text-2xl text-cream mb-3">{f.title}</h3>
              <p className="font-sans text-cream/55 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
