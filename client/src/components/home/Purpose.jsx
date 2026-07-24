import React from 'react';

export default function Purpose() {
  return (
    <section className="py-20 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">Our Purpose</span>
            <h2 className="font-serif text-4xl md:text-5xl text-cream leading-tight mb-6">
              Built for the ones who've <em className="text-gold not-italic">tried everything else.</em>
            </h2>
            <p className="font-sans text-cream/60 leading-relaxed mb-6">
              You've been to social events. You've downloaded the apps. You've had the conversations that went nowhere and left wondering what's missing.
            </p>
            <p className="font-sans text-cream/60 leading-relaxed mb-8">
              What's missing isn't opportunity. It's knowing — before you walk in — that someone there actually wanted to meet you. HeyDer exist to make that possible.
            </p>
            <blockquote className="border-l-2 border-gold pl-6">
              <p className="font-serif text-2xl text-cream italic">
                "Friendship deserves a celebration."
              </p>
              <p className="font-sans text-gold text-sm mt-2 font-medium">— Start by showing up</p>
            </blockquote>
          </div>

          {/* Photo */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gold/5 rounded-3xl blur-xl" />
            <img
              src="https://heyder.nz/wp-content/uploads/2026/06/WhatsApp-Image-2026-06-06-at-2.50.11-PM.jpeg"
              alt="HeyDer dinner"
              className="relative rounded-2xl w-full object-cover aspect-[4/5] shadow-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
