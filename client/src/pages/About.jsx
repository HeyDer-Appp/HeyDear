import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import WhatIsHeyder from '../components/home/WhatIsHeyder';
import HowItWorks from '../components/home/HowItWorks';
import Purpose from '../components/home/Purpose';
import WhyUs from '../components/home/WhyUs';
import Testimonials from '../components/home/Testimonials';
import SocialProof from '../components/home/SocialProof';
import FAQ from '../components/home/FAQ';
import Footer from '../components/layout/Footer';

export default function About() {
  return (
    <div className="min-h-screen bg-navy">
      <Navbar />

      {/* Hero strip */}
      <div className="relative pt-32 pb-16 px-6 border-b border-white/5">
        <div className="max-w-6xl mx-auto">
          <span className="font-sans text-gold text-xs tracking-widest uppercase font-semibold mb-4 block">About HeyDer</span>
          <h1 className="font-serif text-5xl md:text-6xl text-cream leading-tight max-w-xl">
            Why showing up<br />
            <em className="text-gold not-italic">changes everything.</em>
          </h1>
          <div className="mt-8">
            <Link to="/profile" className="btn-primary text-sm">
              SIGN UP NOW — $5
            </Link>
          </div>
        </div>
      </div>

      <div id="about"><WhatIsHeyder /></div>
      <div id="works"><HowItWorks /></div>
      <div id="purpose"><Purpose /></div>
      <div id="whyus"><WhyUs /></div>
      <div id="testimonials"><Testimonials /></div>
      <SocialProof />
      <div id="faq"><FAQ /></div>

      {/* Bottom CTA */}
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
          </p>
          <Link to="/profile" className="btn-primary">SIGN UP NOW</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
