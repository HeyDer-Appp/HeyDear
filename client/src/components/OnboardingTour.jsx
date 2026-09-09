import React, { useState } from 'react';

const STEPS = [
  {
    emoji: '🍽️',
    title: 'My Table',
    body: "This is home base. See your next dinner, its countdown, and RSVP once your group is set.",
  },
  {
    emoji: '👥',
    title: 'Group',
    body: "Once you're matched, chat with your table here before dinner night — say hi, plan a time to meet outside.",
  },
  {
    emoji: '💬',
    title: 'Chat',
    body: "Everyone you've met at a HeyDer dinner shows up here — connect with them and keep the conversation going after.",
  },
  {
    emoji: '📸',
    title: 'Album',
    body: 'Photos shared from past dinners live here — add your own after each one.',
  },
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-sm quiz-card text-center">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4 text-2xl">
          {current.emoji}
        </div>
        <h2 className="font-serif text-2xl text-cream mb-2">{current.title}</h2>
        <p className="font-sans text-cream/50 text-sm leading-relaxed mb-6">{current.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-gold' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={finish} className="flex-1 py-3 rounded-xl border border-white/10 text-cream/50 hover:text-cream font-sans text-xs uppercase tracking-widest transition-colors">
            Skip
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep(s => s + 1))}
            className="quiz-cta flex-1 text-xs py-3"
          >
            {isLast ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
