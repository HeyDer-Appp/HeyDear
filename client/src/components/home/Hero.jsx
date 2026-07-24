import React from 'react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://heyder.nz/wp-content/uploads/2026/04/medium-shot-friends-eating-pizza.jpg-scaled.jpeg"
          alt="Friends dining together"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-navy/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/30 via-transparent to-navy/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20">
        <div className="max-w-3xl">
          {/* Location tag */}
          <div className="flex items-center gap-2 mb-6">
            <img
              src="https://heyder.nz/wp-content/uploads/2026/04/imgi_5_1f4cd.png"
              alt="Auckland"
              className="w-5 h-5"
            />
            <span className="font-sans text-sm text-cream/70 tracking-widest uppercase">Auckland</span>
          </div>

          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-cream leading-tight mb-6">
            Weekly dinners with people looking for someone like{' '}
            <em className="text-gold not-italic">YOU.</em>
          </h1>

          {/* Sub tags */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8">
            {[
              'Just show up.',
              'Curated, not random.',
              'Weekly Tuesday dinners.',
              'Real connections.',
              'Built for you.',
              'Rituals that reward.',
            ].map((tag) => (
              <span key={tag} className="font-sans text-sm text-cream/60">
                <span className="text-yellow font-bold">— </span>{tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-10">
            <Link to="/profile" className="btn-primary text-center">
              SIGN UP NOW
            </Link>
            <a href="/#works" className="btn-outline text-center">
              Find Your Group
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-5 h-8 border-2 border-cream/30 rounded-full flex justify-center pt-1.5">
          <div className="w-1 h-2 bg-cream/40 rounded-full" />
        </div>
      </div>
    </section>
  );
}
