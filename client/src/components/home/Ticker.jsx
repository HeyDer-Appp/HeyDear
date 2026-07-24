import React from 'react';

const items = [
  'Auckland',
  'Just show up',
  'Curated not random',
  'Weekly Tuesday dinners',
  'Real connections',
  'Built for you',
  'Rituals that reward',
  'Auckland',
  'Just show up',
  'Curated not random',
  'Weekly Tuesday dinners',
  'Real connections',
  'Built for you',
  'Rituals that reward',
];

export default function Ticker() {
  return (
    <div className="bg-deep-card border-y border-white/5 py-4 overflow-hidden">
      <div className="ticker-wrap">
        <div className="ticker-inner">
          {[...items, ...items].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-4 mx-6">
              <span className="font-sans text-sm font-medium text-cream/70 tracking-widest uppercase">
                {item}
              </span>
              <span className="text-gold text-lg leading-none">✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
