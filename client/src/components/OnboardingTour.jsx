import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { emoji: '🍽️', title: 'My Table', body: 'Your next dinner and countdown.' },
  { emoji: '👥', title: 'Group', body: 'Chat with your table before dinner.' },
  { emoji: '💬', title: 'Chat', body: 'Stay in touch with people you meet.' },
  { emoji: '📸', title: 'Album', body: 'Photos from past dinners.' },
];

// Shown once, right after profile completion — localStorage flag mirrors
// the same dismissal pattern PushPrompt already uses (heyder_push_dismissed).
export default function OnboardingTour() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('heyder_tutorial_seen') === 'true');
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  const finish = () => {
    localStorage.setItem('heyder_tutorial_seen', 'true');
    setDismissed(true);
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm glass-card text-center"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="w-14 h-14 rounded-full bg-plum/10 border border-plum/20 flex items-center justify-center mx-auto mb-4 text-2xl">
              {current.emoji}
            </div>
            <h2 className="font-serif font-bold text-2xl text-navy mb-1">{current.title}</h2>
            <p className="font-sans text-navy/65 text-sm mb-6">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-5 bg-plum' : 'w-1.5 bg-navy/20'}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={finish} className="flex-1 py-3 rounded-2xl border border-navy/15 text-navy/65 hover:text-navy font-sans text-xs uppercase tracking-widest transition-colors">
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep(s => s + 1))}
            className="plum-cta flex-1 text-xs py-3"
          >
            {isLast ? 'Go' : 'Next'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
