import React from 'react';
import { Link } from 'react-router-dom';

export default function BottomCTA() {
  return (
    <section className="py-24 px-6 bg-dark-card border-t border-white/5">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-block bg-gold/10 text-gold font-sans text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full mb-6">
          $5 booking fee
        </div>
        <h2 className="font-serif text-5xl md:text-6xl text-cream leading-tight mb-4">
          Your table is already<br />
          <em className="text-gold not-italic">waiting for you.</em>
        </h2>
        <p className="font-sans text-cream/55 text-base leading-relaxed mb-10 max-w-xl mx-auto">
          Every Tuesday. 7pm. Auckland. A group of strangers who wanted to meet someone like you.
          All you have to do is show up.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/profile" className="btn-primary">
            SIGN UP NOW
          </Link>
          <a href="mailto:info@heyder.nz" className="btn-outline">
            Get in touch
          </a>
        </div>
        <p className="font-sans text-cream/30 text-xs mt-8">
          Auckland, New Zealand &nbsp;•&nbsp; Every Tuesday at 7pm &nbsp;•&nbsp; $5 to reserve your spot
        </p>
      </div>
    </section>
  );
}
