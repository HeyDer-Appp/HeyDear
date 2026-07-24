import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: 'https://heyder.nz/wp-content/uploads/2026/04/imgi_2_1f3af.png',
    title: 'Matching science',
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
    body: "Every HeyDer dinner includes a ritual that the whole table takes part in together. It's designed to bring everyone closer — and there's a real reward waiting on the other side of it.",
  },
];

export default function WhyUs() {
  return (
    <section id="whyus" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">Why HeyDer</span>
            <h2 className="section-title mb-6">
              Why this works<br />
              <em className="text-gold not-italic">every time.</em>
            </h2>
            <p className="font-sans text-cream/60 text-base leading-relaxed mb-8">
              We don't match you with people like you. We match you with people who would enjoy you. Your profile helps us understand who you are and what you are seeking. Our matching framework does the rest.
            </p>

            <div className="space-y-6">
              {features.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <img src={f.icon} alt={f.title} className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-semibold text-cream text-sm mb-1">{f.title}</h3>
                    <p className="font-sans text-cream/50 text-sm leading-relaxed">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/profile" className="btn-primary inline-block mt-10">
              SIGN UP NOW
            </Link>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-2 gap-4">
            <img
              src="https://heyder.nz/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-06-at-2.50.11-PM.jpeg"
              alt="HeyDer dinner 1"
              className="rounded-2xl w-full object-cover aspect-[3/4]"
            />
            <img
              src="https://heyder.nz/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-06-at-11.52.56-AM-768x736.jpeg"
              alt="HeyDer dinner 2"
              className="rounded-2xl w-full object-cover aspect-[3/4] mt-8"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
