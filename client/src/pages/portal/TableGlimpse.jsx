import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const COUNTRY_FLAGS = {
  'New Zealand': '🇳🇿', 'Australia': '🇦🇺', 'India': '🇮🇳',
  'United Kingdom': '🇬🇧', 'United States': '🇺🇸', 'USA': '🇺🇸', 'China': '🇨🇳',
  'Philippines': '🇵🇭', 'South Africa': '🇿🇦', 'Canada': '🇨🇦',
  'Fiji': '🇫🇯', 'Samoa': '🇼🇸', 'Tonga': '🇹🇴',
  'South Korea': '🇰🇷', 'Japan': '🇯🇵', 'Singapore': '🇸🇬',
  'Malaysia': '🇲🇾', 'Sri Lanka': '🇱🇰', 'Bangladesh': '🇧🇩',
  'Pakistan': '🇵🇰', 'Nepal': '🇳🇵', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'Italy': '🇮🇹', 'Netherlands': '🇳🇱', 'Ireland': '🇮🇪', 'Brazil': '🇧🇷',
  'Colombia': '🇨🇴', 'Mexico': '🇲🇽', 'Zimbabwe': '🇿🇼', 'Nigeria': '🇳🇬',
  'Ghana': '🇬🇭', 'Kenya': '🇰🇪',
};

function getFlag(country) {
  return COUNTRY_FLAGS[country] || '🌏';
}

export default function TableGlimpse() {
  const { tableId } = useParams();
  const [glimpse, setGlimpse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/portal/glimpse/${tableId}`)
      .then(res => setGlimpse(res.data.glimpse || []))
      .catch(err => setError(err.response?.data?.error || 'Could not load your table'))
      .finally(() => setLoading(false));
  }, [tableId]);

  if (loading) return (
    <div className="quiz-bg min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/portal" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-10">
        <p className="font-sans text-gold/70 text-xs tracking-[0.18em] uppercase mb-3 text-center">
          48 hours to go
        </p>
        <h1 className="font-serif text-4xl text-cream mb-3 text-center">Meet your table</h1>
        <p className="font-sans text-cream/50 text-sm mb-10 text-center leading-relaxed max-w-sm mx-auto">
          Here's a glimpse of who's joining you — no names yet, just a hint of who they are.
        </p>

        {error && (
          <div className="quiz-card text-center">
            <p className="font-serif text-xl text-cream mb-2">Not quite yet</p>
            <p className="font-sans text-cream/50 text-sm">{error}</p>
          </div>
        )}

        {!error && glimpse?.length === 0 && (
          <div className="quiz-card text-center">
            <p className="font-sans text-cream/50 text-sm">No tablemates to show yet.</p>
          </div>
        )}

        {!error && glimpse?.length > 0 && (
          <div className="space-y-4">
            {glimpse.map((person, i) => (
              <div key={i} className="quiz-card">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{getFlag(person.country)}</span>
                  <span className="font-sans text-cream/60 text-sm">{person.country || 'Somewhere out there'}</span>
                </div>
                {person.career_kid ? (
                  <p className="font-serif text-lg text-cream italic leading-relaxed">
                    "{person.career_kid}"
                  </p>
                ) : (
                  <p className="font-sans text-cream/30 text-sm italic">No answer shared.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="font-sans text-cream/25 text-xs text-center mt-10">
          Venue and full names reveal 24 hours before dinner.
        </p>
      </div>
    </div>
  );
}
