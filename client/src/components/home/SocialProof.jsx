import React from 'react';
import { Link } from 'react-router-dom';

export default function SocialProof() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <img
              src="https://heyder.nz/wp-content/uploads/2026/05/Untitled-design-10-768x960.png"
              alt="HeyDer social proof"
              className="rounded-2xl w-full max-w-md mx-auto lg:mx-0 shadow-2xl"
            />
          </div>
          <div>
            <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">Real People. Real Dinners.</span>
            <h2 className="section-title mb-6">
              Every Tuesday,<br />
              <em className="text-gold not-italic">something real happens.</em>
            </h2>
            <p className="font-sans text-cream/60 leading-relaxed mb-4">
              HeyDer dinners aren't events. They're the beginning of something. Friendships, collaborations, new circles — all starting with a shared meal.
            </p>
            <p className="font-sans text-cream/60 leading-relaxed mb-8">
              The table is already waiting for you.
            </p>
            <Link to="/profile" className="btn-primary inline-block">
              SIGN UP NOW
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
