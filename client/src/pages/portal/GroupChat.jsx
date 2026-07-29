import React from 'react';
import { Link } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';

export default function GroupChat() {
  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
        <p className="text-4xl mb-4">👥</p>
        <h1 className="font-serif text-2xl text-cream mb-2">Group chat is coming soon</h1>
        <p className="font-sans text-cream/40 text-sm">You'll be able to message your whole table at once here.</p>
      </div>

      <BottomNav />
    </div>
  );
}
