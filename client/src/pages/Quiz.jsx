import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { openCheckout } from '../utils/checkout';
import { tick } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { fileToResizedBase64 } from '../utils/image';
import { DIAL_CODES, COUNTRY_LIST } from '../utils/flags';

// A question's title fades up on entry; its options then fade in from the
// left, one after another, orchestrated by the stagger container below.
// Deliberately slow — this is meant to feel like an unfolding moment, not
// a UI blip.
const easeOutExpo = [0.22, 1, 0.36, 1];
export const fadeUpVariant = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 1, ease: easeOutExpo } },
};
export const staggerContainerVariant = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.32, delayChildren: 0.55 } },
};
export const fadeLeftVariant = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.9, ease: easeOutExpo } },
};

export const CHAPTERS = [
  { id: 'basics', title: 'The Basics', blurb: 'Age, gender, country, relationship status — fast, tappable, zero ceremony.' },
  { id: 'show_up', title: 'How You Show Up', blurb: 'Personality, social battery, career choice — this is where personality questions begin.' },
  { id: 'drawn_to', title: "What You're Drawn To", blurb: 'Who and what draws you in.' },
  { id: 'conversation', title: 'How You Move Through A Conversation', blurb: 'Four quick scales on how you show up in conversation.' },
  { id: 'matters', title: 'What Matters To You', blurb: 'Reliability and money mindset — short and to the point.' },
  { id: 'practical', title: 'The Practical Bits', blurb: 'Budget, dietary needs, and table topics.' },
];

export const QUESTIONS = [
  // Chapter 1 — The Basics
  {
    id: 'personal',
    type: 'personal',
    title: 'About you',
    chapter: 'basics',
    required: true,
  },
  {
    id: 'contact',
    type: 'contact',
    title: 'Contact Number',
    chapter: 'basics',
    required: true,
  },
  {
    id: 'intent',
    type: 'choice',
    title: "What are you hoping to find?",
    field: 'field_cqCcs6psQuhE',
    chapter: 'basics',
    required: true,
    choices: ['Meaningful friendships', 'A fun night out'],
  },
  {
    id: 'relationship',
    type: 'choice',
    title: 'Relationship status',
    field: 'field_3zmnHXYzZn17',
    chapter: 'basics',
    required: true,
    choices: ['Single', 'Married', 'In a relationship', "It's complicated", 'Prefer not to say'],
  },
  {
    id: 'lifestage',
    type: 'choice',
    title: 'Current life stage',
    field: 'field_aIpzE2elktbh',
    chapter: 'basics',
    required: true,
    choices: ['Not Working', 'Student', 'Building Foundations', 'Settled Professional', 'New to city'],
  },

  // Chapter 2 — How You Show Up
  {
    id: 'personality',
    type: 'choice',
    title: "I'm more of",
    field: 'field_L6GblNns9C7v',
    chapter: 'show_up',
    required: true,
    choices: ['Outgoing', 'Reserved', 'Bit of both'],
  },
  {
    id: 'battery',
    type: 'choice',
    title: 'My social battery these days',
    field: 'field_LosYJHqrbpKO',
    chapter: 'show_up',
    required: true,
    choices: ['Never runs out', 'Need occasional charging', 'Drains pretty fast'],
  },
  {
    id: 'career_pref',
    type: 'choice',
    title: 'What career would you choose?',
    field: 'field_lS4ks7Km1VlA',
    chapter: 'show_up',
    required: true,
    choices: ['Rom-com actor', 'Counsellor', 'Stand up comedian', 'Life Coach'],
  },
  {
    id: 'social_circle',
    type: 'choice',
    title: 'My social circle is',
    field: 'field_TaGZoiuhOhh2',
    chapter: 'show_up',
    required: true,
    choices: ['Small but close', 'Decent but need depth', 'Mostly online', 'Pretty much none'],
  },
  {
    id: 'weekends',
    type: 'choice',
    title: "Most weekends I'm...",
    field: 'field_pCwGXuvIxGTu',
    chapter: 'show_up',
    required: true,
    choices: ['Out with people', 'Family time', 'Solo recharging', 'Hobby engagement'],
  },
  {
    id: 'career_desc',
    type: 'text',
    title: 'How would you describe your career/job to a kid?',
    field: 'field_MQDZqx7wid2f',
    chapter: 'show_up',
    required: true,
    placeholder: 'Be creative...',
  },

  // Chapter 3 — What You're Drawn To
  {
    id: 'group_role',
    type: 'choice',
    title: 'In a group I naturally...',
    field: 'group_role',
    chapter: 'drawn_to',
    required: true,
    choices: [
      'Comes up with the wild ideas',
      'Keeps everyone on track',
      "Makes sure no one's left out",
      'Asks the smart, cautious questions',
    ],
  },
  {
    id: 'connection_trigger',
    type: 'choice',
    title: 'You connect fastest with people who are...',
    field: 'connection_trigger',
    chapter: 'drawn_to',
    required: true,
    choices: ['Funny', 'Deep', 'Unapologetic'],
  },
  {
    id: 'social_recharge',
    type: 'scale',
    title: 'After a big night out I feel',
    field: 'social_recharge',
    chapter: 'drawn_to',
    required: true,
    min: 0, max: 10,
    labels: ['Wiped out', 'Recharged'],
  },

  // Chapter 4 — How You Move Through A Conversation
  {
    id: 'deep_convo',
    type: 'scale',
    title: 'I enjoy deep conversations',
    field: 'field_PyYcCusA8b74',
    chapter: 'conversation',
    required: true,
    min: 0, max: 10,
    labels: ['Disagree', 'Strongly agree'],
  },
  {
    id: 'sarcastic',
    type: 'scale',
    title: 'I am sarcastic in nature',
    field: 'field_Y8VLrSMSZLmb',
    chapter: 'conversation',
    required: true,
    min: 0, max: 10,
    labels: ['Not at all', 'Very much so'],
  },
  {
    id: 'initiate',
    type: 'scale',
    title: 'I usually initiate plans',
    field: 'field_H4KwwtKh8sYF',
    chapter: 'conversation',
    required: true,
    min: 0, max: 10,
    labels: ['Never', 'Always'],
  },
  {
    id: 'curious',
    type: 'scale',
    title: 'You ask questions when curious',
    field: 'field_OqnhJdRIytBz',
    chapter: 'conversation',
    required: true,
    min: 0, max: 10,
    labels: ['No, I wait', 'Yes, immediately'],
  },

  // Chapter 5 — What Matters To You
  {
    id: 'reliability',
    type: 'scale',
    title: 'How important is reliability to you?',
    field: 'field_1NDB7q3CaeDQ',
    chapter: 'matters',
    required: true,
    min: 0, max: 10,
    labels: ['Not important', 'Critical'],
  },
  {
    id: 'financial',
    type: 'scale',
    title: 'When I think about the future - financial security comes first',
    field: 'field_heE41fid4m48',
    chapter: 'matters',
    required: true,
    min: 0, max: 10,
    labels: ['Disagree', 'Strongly agree'],
  },

  // Chapter 6 — The Practical Bits
  {
    id: 'budget',
    type: 'choice',
    title: "What's your budget for the set menu?",
    field: 'field_Ar4xQbXT6CLh',
    chapter: 'practical',
    required: true,
    choices: ['$45-$50', '$50-$55'],
  },
  {
    id: 'dietary',
    type: 'multi_choice',
    title: 'Any dietary preferences we should know?',
    field: 'field_OVB7lzEjSl7C',
    chapter: 'practical',
    required: false,
    choices: ['Not Applicable', 'Gluten free', 'Dairy free', 'Nut free', 'Vegan', 'Vegetarian', 'Other'],
    allowOther: true,
    otherField: 'dietary_other',
  },
  {
    id: 'topics',
    type: 'choice',
    title: 'What do you love talking about?',
    field: 'field_TQFTxLhIZnOf',
    chapter: 'practical',
    required: true,
    choices: ['Pop Culture', 'Sports', 'Politics'],
  },

  // Outside the chapters — date & payment stay their own final steps
  {
    id: 'date',
    type: 'choice',
    title: 'Which Tuesday night works for you?',
    field: 'field_CdZldwp5q09o',
    required: true,
    choices: ['30th June 2026', '7th July 2026'],
  },
  {
    id: 'payment',
    type: 'payment',
    title: 'Reserve your spot',
    description: 'Choose how you\'d like to join.',
  },
];

// Date of birth must land somewhere plausible — at least 18 (this is a
// dinner-dating app) and no more than 100 years ago. Bounds the native date
// picker itself so an impossible date (e.g. tomorrow, or 5 years old) can't
// be selected in the first place.
const todayForDob = new Date();
const MAX_DOB = new Date(todayForDob.getFullYear() - 18, todayForDob.getMonth(), todayForDob.getDate())
  .toISOString().split('T')[0];
const MIN_DOB = new Date(todayForDob.getFullYear() - 100, todayForDob.getMonth(), todayForDob.getDate())
  .toISOString().split('T')[0];

const COUNTRIES = [...COUNTRY_LIST, 'Other'];

// transition-colors (not transition-all) so this never touches `transform` —
// Framer Motion owns transform on these buttons during their entrance, and
// a CSS transition racing it on the same property is what caused the shake.
export const choiceBase =
  'text-left px-4 py-2.5 rounded-xl border font-sans text-base transition-colors duration-150 cursor-pointer';
export const choiceIdle =
  'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95';
// No font-weight change here on purpose — a bolder selected label is wider,
// which reflows every other button in the row and reads as "losing position".
export const choiceActive =
  'border-gold bg-gold text-navy shadow-[0_4px_16px_rgba(232,168,84,0.2)]';

export const DATE_Q = QUESTIONS.find(q => q.id === 'date');

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The next `count` upcoming Tuesdays from today, formatted to match the
// admin-configured choices' own style (e.g. "30th June 2026") — used as the
// displayed date options directly, rather than whatever was last fetched
// from /profile/questions, which can go stale if the admin-set availability
// isn't kept current.
function getNextTuesdays(count) {
  const results = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const daysUntilTuesday = (2 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilTuesday);
  for (let i = 0; i < count; i++) {
    results.push(`${ordinal(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
    d.setDate(d.getDate() + 7);
  }
  return results;
}
// Mirrors payments.js's SIGNUP_INSTANT_PAY_DISCOUNT_PERCENT — display-only
// here, the server re-applies the real discount independently at checkout.
export const SIGNUP_DISCOUNT_PERCENT = 10;
const CHAPTER_QUESTIONS = CHAPTERS.map(chap => ({
  chapter: chap,
  questions: QUESTIONS.filter(q => q.chapter === chap.id),
}));

// Typeform-style pacing: one question per screen, moving forward linearly.
// The profile photo isn't a page at all — it's a persistent avatar button in
// the header (opens a dialog) so it stays reachable throughout the flow.
const STEPS = [
  ...QUESTIONS.filter(q => q.id !== 'date' && q.id !== 'payment').map(q => ({ type: 'question', question: q })),
  { type: 'date' },
  { type: 'payment' },
];

const LETTERS = 'ABCDEFGHIJ';

// Local-only light-theme palette for the redesigned question screens —
// deliberately NOT exported, unlike choiceIdle/choiceActive above, since
// those two are shared with BookDinner.jsx and EditProfile.jsx which still
// use the original dark quiz-bg theme. Changing those would reskin pages
// nobody's reviewed yet.
const lightChoiceIdle =
  'border-transparent bg-navy/[0.04] text-navy/70 hover:bg-navy/[0.08] hover:text-navy';
const lightChoiceActive =
  'border-navy bg-transparent text-navy font-semibold';
const QUIZ_CREAM_BG = '#E7DFC5';

// Every field that has to be filled in before the profile counts as "done" —
// drives both the completion % and the final submit validation.
const REQUIRED_FIELD_QUESTIONS = QUESTIONS.filter(q => q.required && q.field);

function isAnswered(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== '' && value !== null;
}

// The date input's min/max attributes stop the picker UI from offering an
// impossible date, but someone can still type one directly into the field's
// segments on desktop — so this gets checked again here as a backstop.
function isDobValid(dob) {
  if (!dob) return false;
  return dob >= MIN_DOB && dob <= MAX_DOB;
}

// Contact number can be skipped entirely, but if someone's typed anything
// at all it has to be 9 or 10 digits (NZ mobiles are 9, most others we see
// are 10) — the input itself already strips non-digits and caps at 10 as
// they type, this is just the submit-time backstop.
export function isPhoneValid(phone) {
  if (!phone) return true;
  return /^\d{9,10}$/.test(phone);
}

// A volume-style slider for scale questions. The fill bar and thumb are
// plain divs updated by directly mutating their style/text via refs on every
// native 'input' tick — bypassing React's render cycle entirely during the
// drag itself — which is what gets this close to a native OS slider's feel
// instead of the usual React-controlled-input lag. The underlying <input
// type="range"> is fully transparent and uncontrolled (defaultValue, not
// value); it only exists to own real pointer/touch/keyboard drag handling
// and accessibility. The parent's onChange (which updates top-level answers
// state and schedules an autosave) fires once on release, not per tick.
export function ScaleSlider({ q, value, onChange, theme = 'dark' }) {
  const inputRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const numberRef = useRef(null);
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  // pct is continuous (0..1) — the thumb glides with the raw pointer
  // position, pixel for pixel, instead of jumping between the 11 discrete
  // step positions. Only the displayed number snaps to the nearest integer;
  // the visual position never does. This is what actually reads as smooth —
  // a CSS transition on a value that updates every drag frame just adds a
  // fixed delay behind the real finger/cursor position, which is lag, not
  // smoothness (tried that, made it worse).
  const applyVisualPct = (pct) => {
    const clamped = Math.min(1, Math.max(0, pct));
    if (fillRef.current) fillRef.current.style.width = `${clamped * 100}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${clamped * 100}%`;
  };

  const applyVisual = (v) => {
    applyVisualPct((v - q.min) / (q.max - q.min));
    if (numberRef.current) numberRef.current.textContent = v;
  };

  // A short pulse each time the drag crosses into a new integer step — reads
  // as a tick per notch rather than a continuous buzz. Silently does nothing
  // on browsers/devices without the Vibration API (iOS Safari, desktop).
  const lastVibrateValue = useRef(null);
  const maybeVibrate = (v) => {
    if (lastVibrateValue.current === v) return;
    lastVibrateValue.current = v;
    tick();
  };

  // Bypasses the native <input type="range">'s own drag handling entirely —
  // its onInput cadence isn't reliably high-frequency enough across
  // browsers/devices to look fluid when driving a separate visual element.
  // Reading the pointer position directly on every pointermove (which does
  // fire at full frequency) removes that dependency completely. The native
  // input stays underneath, pointer-events disabled, purely so Tab +
  // arrow-key access still works for keyboard users.
  const pctFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, pct));
  };

  const handlePointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pct = pctFromClientX(e.clientX);
    applyVisualPct(pct);
    const snapped = Math.round(q.min + pct * (q.max - q.min));
    if (numberRef.current) numberRef.current.textContent = snapped;
    maybeVibrate(snapped);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const pct = pctFromClientX(e.clientX);
    applyVisualPct(pct);
    const snapped = Math.round(q.min + pct * (q.max - q.min));
    if (numberRef.current) numberRef.current.textContent = snapped;
    maybeVibrate(snapped);
  };

  const commit = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const pct = pctFromClientX(e.clientX);
    const snapped = Math.round(q.min + pct * (q.max - q.min));
    applyVisual(snapped);
    if (inputRef.current) inputRef.current.value = snapped;
    onChange(snapped);
  };

  useEffect(() => {
    const v = value ?? q.min;
    if (inputRef.current) inputRef.current.value = v;
    applyVisual(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, q.min]);

  // The track always visually shows q.min (0 for every scale question here)
  // until touched, but onChange only ever fired on release — so leaving it
  // untouched at that displayed value never actually recorded an answer,
  // and "Next" blocked as if the question were skipped. Recording q.min as
  // the real answer on mount keeps what's shown and what's stored in sync
  // from the first render.
  useEffect(() => {
    if (value === undefined) onChange(q.min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const light = theme === 'light';
  return (
    <div>
      <div className="flex justify-between mb-3">
        <span className={`font-sans text-xs ${light ? 'text-navy/50' : 'text-cream/35'}`}>{q.labels?.[0]}</span>
        <span className={`font-sans text-xs ${light ? 'text-navy/50' : 'text-cream/35'}`}>{q.labels?.[1]}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-8"
      >
        {light ? (
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full backdrop-blur-sm"
            style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(22,24,29,0.15)' }}
          />
        ) : (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-[#e7dcbd]/10" />
        )}
        <div
          ref={fillRef}
          className="quiz-slider-fill absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none" style={{ background: '#754471' }}
        />
        <div
          ref={thumbRef}
          className="quiz-slider-thumb-visual absolute top-1/2 w-8 h-8 -translate-y-1/2 -translate-x-1/2 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
          style={{ background: '#754471', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={commit}
          onPointerCancel={commit}
        >
          <span ref={numberRef} className="font-sans text-xs font-bold leading-none select-none text-cream" />
        </div>
        {/* Kept for keyboard access only (Tab + arrow keys) — pointer
            interaction is fully handled above instead of relying on this. */}
        <input
          ref={inputRef}
          type="range"
          min={q.min}
          max={q.max}
          step={1}
          defaultValue={value ?? q.min}
          onInput={e => { const v = Number(e.target.value); applyVisual(v); maybeVibrate(v); }}
          onKeyUp={e => onChange(Number(e.target.value))}
          className="quiz-slider absolute inset-0 w-full h-full pointer-events-none"
          style={{ pointerEvents: 'none' }}
          aria-label={q.title}
        />
      </div>
    </div>
  );
}

// Typeform's shell for a single screen: a numbered badge beside the
// question, both centered as one unit within the viewport, with the answer
// widget indented to sit under the title rather than under the badge.
export function QuestionShell({ number, title, required, description, error, children, titleFont = 'serif' }) {
  return (
    <motion.div
      className={`w-full ${error ? 'rounded-2xl -mx-4 px-4 py-4 bg-red-500/5' : ''}`}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeUpVariant} className="mb-3">
        <p
          className={titleFont === 'marker' ? 'text-3xl md:text-4xl text-navy leading-snug' : 'font-serif font-bold text-2xl md:text-3xl text-navy leading-snug'}
          style={titleFont === 'marker' ? { fontFamily: "'Permanent Marker', cursive" } : undefined}
        >
          {title}
          {/* Non-breaking space so the asterisk can't wrap onto its own
              line, orphaned below the title on narrow screens. */}
          {required && <span className="text-navy/50 align-super text-base">{' *'}</span>}
        </p>
        {description && <p className="font-sans text-navy/45 text-sm mt-2">{description}</p>}
      </motion.div>
      <div>{children}</div>
    </motion.div>
  );
}

// Same frosted-glass dropdown as the Location screen's CityDropdown
// (Dashboard.jsx) -- replaces the plain native <select> look (browser's
// own default arrow, no glass) for gender/country/dial-code here, so
// every dropdown in the signup flow reads as one consistent style.
// `options` is either an array of strings, or [value, label] pairs.
function GlassSelect({ value, onChange, options, placeholder, className = '', error }) {
  const [open, setOpen] = useState(false);
  const normalized = options.map(o => Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: o });
  const selectedOption = normalized.find(o => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 font-sans text-base text-navy transition-all"
        style={{
          background: 'rgba(255,255,255,0.35)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          border: error ? '1px solid rgba(248,113,113,0.6)' : '1px solid rgba(22,24,29,0.12)',
          boxShadow: '0 6px 18px rgba(22,24,29,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <span className={`truncate ${value ? 'text-navy' : 'text-navy/40'}`}>{selectedOption?.label || placeholder}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className="text-navy/50 transition-transform duration-200 flex-shrink-0 ml-2"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-10 max-h-60 overflow-y-auto"
          style={{
            background: 'rgba(231,223,197,0.95)',
            backdropFilter: 'blur(10px) saturate(140%)',
            WebkitBackdropFilter: 'blur(10px) saturate(140%)',
            border: '1px solid rgba(22,24,29,0.12)',
            boxShadow: '0 10px 28px rgba(22,24,29,0.12)',
          }}
        >
          {normalized.map((opt, i) => (
            <button
              key={`${opt.value}-${i}`}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-5 py-3 font-sans text-sm text-navy hover:bg-navy/5 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Typeform's lettered circular badge (A, B, C...) before each pill-shaped
// choice -- content-width, never stretched, stacked vertically.
function ChoicePills({ choices, selected, onSelect, multi }) {
  return (
    <motion.div variants={staggerContainerVariant} className="flex flex-col items-start gap-2.5">
      {choices.map((choice, i) => {
        const isSelected = multi ? (selected || []).includes(choice) : selected === choice;
        return (
          <motion.button
            key={choice}
            variants={fadeLeftVariant}
            type="button"
            onClick={() => onSelect(choice)}
            className={`flex items-center gap-3 ${choiceBase} ${isSelected ? lightChoiceActive : lightChoiceIdle}`}
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-navy text-cream flex items-center justify-center text-[11px] font-sans font-semibold">
              {LETTERS[i]}
            </span>
            {choice}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// A small, visually distinct pill -- deliberately unlike the answer-choice
// buttons above -- so "confirm and move on" never reads as just another
// option in the list.
export function OkButton({ onClick, disabled, children = 'OK' }) {
  return (
    <motion.button
      variants={fadeUpVariant}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 bg-transparent border-2 border-navy text-navy font-sans font-semibold text-sm px-6 py-2.5 rounded-full mt-5 transition-colors hover:bg-navy hover:text-cream disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}

// One question's answer widget -- reused across every question screen.
function QuestionField({ q, value, onChange, otherValue, onOtherChange }) {
  return (
    <>
      {q.type === 'yes_no' && (
        <ChoicePills
          choices={['Yes', 'No']}
          selected={value === true ? 'Yes' : value === false ? 'No' : undefined}
          onSelect={choice => onChange(choice === 'Yes')}
        />
      )}

      {q.type === 'choice' && (
        <ChoicePills choices={q.choices} selected={value} onSelect={onChange} />
      )}

      {q.type === 'multi_choice' && (
        <>
          <ChoicePills
            choices={q.choices}
            selected={value}
            multi
            onSelect={choice => {
              const cur = value || [];
              if (choice === 'Not Applicable') { onChange(['Not Applicable']); return; }
              const filtered = cur.filter(c => c !== 'Not Applicable');
              const selected = cur.includes(choice);
              onChange(selected ? filtered.filter(c => c !== choice) : [...filtered, choice]);
            }}
          />
          {q.allowOther && (value || []).includes('Other') && (
            <input
              type="text"
              value={otherValue || ''}
              onChange={e => onOtherChange(e.target.value)}
              placeholder="Tell us what we should know..."
              className="w-full bg-navy/[0.03] border border-navy/15 rounded-xl px-4 py-3 mt-3 text-navy placeholder-navy/35 font-sans text-sm focus:outline-none focus:border-navy/40"
            />
          )}
        </>
      )}

      {q.type === 'scale' && <ScaleSlider q={q} value={value} onChange={onChange} theme="light" />}

      {q.type === 'text' && (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={q.placeholder}
          rows={3}
          className="w-full bg-navy/[0.03] border border-navy/15 rounded-xl px-4 py-3 text-navy placeholder-navy/35 font-sans text-sm focus:outline-none focus:border-navy/40 resize-none"
        />
      )}
    </>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const { attendeeUser } = useAuth();
  // The city picker on the dashboard's pre-profile screen stashes the
  // selected city here since it can't pass props across a route navigation
  // — picked up once on mount so it rides along in the /profile/submit
  // payload below instead of being silently dropped.
  const [answers, setAnswers] = useState(() => {
    const city = sessionStorage.getItem('heyder_signup_city');
    return city ? { city } : {};
  });
  const [errors, setErrors] = useState({});
  const [disqualified, setDisqualified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [showSkipDiscountModal, setShowSkipDiscountModal] = useState(false);
  const [dateOptionsOpen, setDateOptionsOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [dateChoices, setDateChoices] = useState(() => getNextTuesdays(3));
  const [savedAt, setSavedAt] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [showPhotoBubble, setShowPhotoBubble] = useState(true);
  // Falls back to the same $10/$15 defaults the server uses until the real
  // (admin-editable) price loads — never a placeholder like $0.
  const [pricing, setPricing] = useState({ oneTimeAmount: 1000, subscriptionAmount: 1500 });
  const hasLoadedRef = useRef(false);
  const autosaveTimer = useRef(null);

  useEffect(() => {
    api.get('/payments/pricing').then(res => setPricing(res.data)).catch(() => {});
  }, []);

  // On native builds, Stripe checkout opens in the phone's own browser —
  // this page's WebView never navigates away, so coming back to the app
  // just re-shows this exact page, frozen mid "Processing...". Whenever the
  // app becomes visible again with a payment still pending, check whether
  // it actually went through instead of leaving that button stuck forever.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const checkPendingPayment = async () => {
      const pendingSessionId = sessionStorage.getItem('heyder_pending_session_id');
      if (!pendingSessionId || cancelled) return;
      attempts += 1;
      try {
        const res = await api.get(`/payments/verify/${pendingSessionId}`);
        if (cancelled) return;
        if (res.data.paid) {
          sessionStorage.removeItem('heyder_pending_session_id');
          navigate('/profile/success');
          return;
        }
      } catch {
        // ignore — treated the same as "not confirmed yet" below
      }
      // Webhooks land almost instantly, well before a human can switch back
      // to the app — but give it a couple of retries before giving up
      // rather than deciding "not paid" on one unlucky check.
      if (attempts < 3) {
        setTimeout(checkPendingPayment, 2500);
      } else {
        sessionStorage.removeItem('heyder_pending_session_id');
        setSubmitting(false);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') { attempts = 0; checkPendingPayment(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('heyder:checkoutClosed', onVisible);
    checkPendingPayment();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('heyder:checkoutClosed', onVisible);
    };
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stepIndex]);

  useEffect(() => {
    api.get('/portal/full-profile')
      .then(res => {
        const { locked, hasActiveSubscription: hasSub, photo, answers: savedAnswers, profileComplete: isComplete } = res.data;
        setAnswers(prev => ({
          ...prev,
          first_name: locked.first_name,
          last_name: locked.last_name,
          phone: locked.phone,
          dob: locked.dob,
          gender: locked.gender,
          country: locked.country,
          photo: photo || undefined,
          ...savedAnswers,
        }));
        setHasActiveSubscription(!!hasSub);
        // A profile that's already been submitted once has nothing left to
        // build — /profile is for constructing a profile from scratch, not
        // for booking again, so send returning members to the dedicated
        // booking page instead of walking them back through every chapter.
        if (isComplete) {
          navigate('/portal/book', { replace: true });
          return;
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingProfile(false);
        // Only start autosaving once the initial prefill has landed, so
        // loading someone's existing answers doesn't immediately "save" them
        // straight back (harmless, but a wasted round-trip on every visit).
        hasLoadedRef.current = true;
      });
  }, []);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Debounced autosave — saves whatever's been filled in so far, so closing
  // the tab mid-profile doesn't lose progress. Doesn't require every
  // required field, and never touches profileComplete or bookings. Only
  // triggered by an actual edit (via setValue), never by the initial
  // prefill loading someone's existing answers back in.
  const scheduleAutosave = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      api.patch('/profile/autosave', answersRef.current)
        .then(() => setSavedAt(Date.now()))
        .catch(() => {});
    }, 900);
  };

  useEffect(() => () => clearTimeout(autosaveTimer.current), []);

  const firstName = answers.first_name?.trim();
  // No Stripe publishable key configured yet — booking still works end to
  // end, it just skips the real checkout and completes immediately.
  const stripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  const setValue = (field, value) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
    setErrors(prev => (prev[field] ? { ...prev, [field]: false } : prev));
    if (hasLoadedRef.current) scheduleAutosave();
  };

  const handleFieldAnswer = (q, value) => {
    if (q.disqualifyIfNo && value === false) {
      setDisqualified(true);
      return;
    }
    setValue(q.field, value);
  };

  const step = STEPS[stepIndex];

  // Shown above the question itself, outside the per-question slide
  // animation, so it holds its position and only changes (cross-fading)
  // when the chapter actually changes — not on every single question.
  const chapterTitle = step.type === 'question' && step.question.chapter
    ? CHAPTERS.find(c => c.id === step.question.chapter)?.title
    : null;

  // Blocks Next until every required (*) field on THIS page is answered —
  // the final submit still re-validates everything, but this stops someone
  // from clicking through a whole page of starred questions unanswered.
  const validateStep = (s) => {
    const newErrors = {};
    const missingIds = [];

    let underage = false;

    if (s.type === 'question') {
      const q = s.question;
      if (q.type === 'contact') {
        // No longer skippable — a phone number is mandatory to proceed.
        if (!isPhoneValid(answers.phone)) {
          newErrors.phone = true;
          missingIds.push('contact');
        } else if (q.required && !isAnswered(answers.phone)) {
          newErrors.phone = true;
          missingIds.push('contact');
        }
      } else if (q.type === 'personal') {
        if (!isDobValid(answers.dob)) {
          newErrors.dob = true;
          missingIds.push('personal');
          if (answers.dob) underage = true;
        }
        if (!answers.gender) { newErrors.gender = true; missingIds.push('personal'); }
        if (!answers.country) { newErrors.country = true; missingIds.push('personal'); }
      } else if (q.required && q.field && !isAnswered(answers[q.field])) {
        newErrors[q.field] = true;
        missingIds.push(q.id);
      }
    } else if (s.type === 'date') {
      if (!isAnswered(answers.field_CdZldwp5q09o)) {
        newErrors.field_CdZldwp5q09o = true;
        missingIds.push('date');
      }
    }

    if (missingIds.length) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      // A typed-but-invalid DOB (someone under 18, or a date so old it's
      // clearly a typo) needs its own message — "fill in the highlighted
      // fields" reads as if the date box is empty, which it isn't.
      toast.error(underage ? 'You must be 18 or older to join HeyDer.' : 'Please fill in the highlighted fields.');
      document.getElementById(`q-${missingIds[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  // Maps a question id back to the page it lives on, so a failed final
  // validation can jump to the right page before scrolling to the field —
  // only the current page's fields are ever in the DOM.
  const stepIndexForQuestionId = (qid) => {
    if (qid === 'date') return STEPS.findIndex(s => s.type === 'date');
    return STEPS.findIndex(s => s.type === 'question' && s.question.id === qid);
  };

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const dataUrl = await fileToResizedBase64(file);
      setValue('photo', dataUrl);
    } catch (err) {
      toast.error(err.message || 'Could not use that photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const chapterDone = (chapterId) => {
    // The 'personal' pseudo-question has no single `field` — it's really
    // dob/gender/country, which personalDone checks separately — so it has
    // to be excluded here or every chapter with one would look permanently
    // incomplete (answers[undefined] is never "answered").
    const qs = CHAPTER_QUESTIONS.find(c => c.chapter.id === chapterId).questions.filter(q => q.required && q.field);
    return qs.length > 0 && qs.every(q => isAnswered(answers[q.field]));
  };

  const personalDone = !!(answers.dob && answers.gender && answers.country);

  const totalRequired = REQUIRED_FIELD_QUESTIONS.length + 3 + 1; // +personal (dob/gender/country) +date
  const filledRequired =
    REQUIRED_FIELD_QUESTIONS.filter(q => isAnswered(answers[q.field])).length +
    ['dob', 'gender', 'country'].filter(k => isAnswered(answers[k])).length +
    (isAnswered(answers.field_CdZldwp5q09o) ? 1 : 0);
  const completionPct = Math.round((filledRequired / totalRequired) * 100);
  const profileReady = CHAPTERS.every(c => chapterDone(c.id)) && personalDone;

  const profileChips = useMemo(() => {
    const chips = [];
    if (firstName) chips.push({ icon: '👋', label: firstName });
    if (answers.field_cqCcs6psQuhE) {
      chips.push({
        icon: answers.field_cqCcs6psQuhE === 'Meaningful friendships' ? '💙' : '🎉',
        label: answers.field_cqCcs6psQuhE === 'Meaningful friendships' ? 'Meaningful' : 'Fun night',
      });
    }
    if (answers.field_L6GblNns9C7v) chips.push({ icon: '🙋', label: answers.field_L6GblNns9C7v });
    return chips;
  }, [firstName, answers.field_cqCcs6psQuhE, answers.field_L6GblNns9C7v]);

  const scrollToFirstError = (missingIds) => {
    const jumpTo = (id) => document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const targetStep = stepIndexForQuestionId(missingIds[0]);
    if (targetStep !== -1 && targetStep !== stepIndex) {
      setStepIndex(targetStep);
      setTimeout(() => jumpTo(missingIds[0]), 50);
    } else {
      jumpTo(missingIds[0]);
    }
  };

  // skipDate is true for "choose later" — everything else about the profile
  // still has to be complete, just not which Tuesday, since no booking gets
  // made at all in that case.
  const validate = (skipDate = false) => {
    const newErrors = {};
    const missingIds = [];

    let underage = false;

    for (const q of REQUIRED_FIELD_QUESTIONS) {
      if (!isAnswered(answers[q.field])) { newErrors[q.field] = true; missingIds.push(q.id); }
    }
    if (!isDobValid(answers.dob)) {
      newErrors.dob = true;
      missingIds.push('personal');
      if (answers.dob) underage = true;
    }
    if (!answers.gender) { newErrors.gender = true; missingIds.push('personal'); }
    if (!answers.country) { newErrors.country = true; missingIds.push('personal'); }
    if (!skipDate && !isAnswered(answers.field_CdZldwp5q09o)) { newErrors.field_CdZldwp5q09o = true; missingIds.push('date'); }
    if (!isPhoneValid(answers.phone)) {
      newErrors.phone = true;
      missingIds.push('contact');
    } else if (!isAnswered(answers.phone)) {
      newErrors.phone = true;
      missingIds.push('contact');
    }

    setErrors(newErrors);
    if (missingIds.length) {
      // missingIds is built in field-check order (generic fields, then
      // personal, then contact), not the order those questions actually
      // appear in the flow — sorting by real step index before jumping
      // makes sure "Skip for now" always lands on the *first* incomplete
      // screen rather than whichever category happened to be checked first.
      const sortedMissingIds = [...missingIds].sort((a, b) => stepIndexForQuestionId(a) - stepIndexForQuestionId(b));
      // "Please fill in the highlighted fields" alone left someone stuck on
      // whatever screen they were already on with no clue what to go fix —
      // especially jarring from "Not sure yet", which reads as a dead end
      // instead of the one-more-thing it actually is. Naming the actual
      // question fixes that regardless of which one it turns out to be.
      const firstMissingTitle = QUESTIONS.find(q => q.id === sortedMissingIds[0])?.title;
      toast.error(
        underage
          ? 'You must be 18 or older to join HeyDer.'
          : firstMissingTitle
          ? `One more thing first — "${firstMissingTitle}".`
          : 'Please fill in the highlighted fields.'
      );
      scrollToFirstError(sortedMissingIds);
      return false;
    }
    return true;
  };

  // applySignupDiscount is only true when this fires from the "Skip for
  // now" recovery popup's "Pay & save 10%" button — a direct click on the
  // main pay button never gets the automatic discount, only a coupon does.
  const handlePayment = async (plan, applySignupDiscount = false) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        await submitQuizWithoutPayment(plan);
        return;
      }

      // Save the profile + booking BEFORE sending anyone to pay, not after.
      // Stripe hands off to a *different* browser context on native apps
      // (the phone's own browser, not this app's WebView) — that context
      // has no access to this page's sessionStorage or even this login
      // session, so waiting until after payment to save anything meant a
      // real, successful charge could still end up with nothing recorded
      // at all. Saving first means the booking/profile exist regardless of
      // what happens after the redirect — payment success just links the
      // charge on top of a booking that's already there.
      // awaitingPayment marks the new booking unpaid until Stripe actually
      // confirms it — otherwise abandoning checkout entirely (closing the
      // external browser tab without paying) still left a real-looking
      // "booked" dinner on the dashboard, since this save happens before
      // any payment attempt at all.
      await api.post('/profile/submit', {
        ...answers,
        field_OVB7lzEjSl7C: answers.field_OVB7lzEjSl7C || [],
        awaitingPayment: true,
      });

      const res = await api.post('/payments/create-checkout', {
        email: attendeeUser?.email,
        plan,
        couponCode: appliedCoupon?.code,
        ...(applySignupDiscount && !appliedCoupon ? { context: 'signup' } : {}),
      });
      sessionStorage.setItem('heyder_quiz_answers', JSON.stringify(answers));
      // Stripe opens in the phone's own browser on native builds — this
      // page's WebView never actually navigates away, so it's still sitting
      // right here (still showing "Processing...") whenever the app is
      // switched back into. Remembering the session id lets the resume
      // listener below check whether that payment actually went through
      // instead of leaving the button frozen forever.
      sessionStorage.setItem('heyder_pending_session_id', res.data.sessionId);
      // A plain redirect to the URL the server already returned, rather
      // than loading the whole Stripe.js SDK just to call its (now legacy)
      // redirectToCheckout — one less external script that can fail to
      // load (slow network, an ad-blocker, a CSP quirk) and surface as a
      // vague "Payment setup failed" with no useful detail behind it.
      openCheckout(res.data.url);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment setup failed. Please try again.');
      setSubmitting(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/payments/validate-coupon', { code: couponInput.trim() });
      setAppliedCoupon({ code: res.data.code, discountPercent: res.data.discountPercent });
      toast.success(`${res.data.discountPercent}% off applied!`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.error || 'That code is invalid or has expired.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); setCouponError(''); };

  // plan is only relevant in test mode (no Stripe key) — a real Stripe
  // session already tells the server which plan was bought via
  // reconcileStripeSession, but a simulated booking has no session to read
  // that from, so it has to be passed through explicitly or "subscription"
  // silently produces zero subscription record at all.
  const submitQuizWithoutPayment = async (plan) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/profile/submit', {
        ...answers,
        field_OVB7lzEjSl7C: answers.field_OVB7lzEjSl7C || [],
        plan,
      });
      navigate('/profile/success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  // "Skip for now" / "I'll choose later" both build the account only — no
  // dinner gets reserved, since booking one is only ever allowed alongside
  // real payment (or an active subscription), never for free. They land on
  // the dashboard and can book — and pay — whenever they're ready.
  // skipDate is true when called from the date step itself, before any
  // Tuesday has been picked.
  const skipPayment = async (skipDate = false) => {
    if (!validate(skipDate)) return;
    setSubmitting(true);
    try {
      const { field_CdZldwp5q09o, ...rest } = answers;
      await api.post('/profile/submit', {
        ...rest,
        ...(skipDate ? {} : { field_CdZldwp5q09o }),
        field_OVB7lzEjSl7C: answers.field_OVB7lzEjSl7C || [],
        skip_booking: true,
      });
      // Skipping the date itself means no dinner was picked at all, so the
      // "you're in, booking confirmed" success screen would be misleading —
      // straight to the dashboard instead, matching the comment above. That
      // screen's own booking prompt asks the same "which Tuesday?" question
      // again right away, which reads as if "I'll choose later" was ignored
      // — this toast is the only acknowledgment that it wasn't.
      if (skipDate) toast.success("No rush — book your Tuesday whenever you're ready.");
      navigate(skipDate ? '/portal/dashboard' : '/profile/success');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    // No fade here on purpose — this screen and the arriving-from screen
    // (Home's post-video navy) are the same exact color, so an instant,
    // un-animated swap into this state is invisible. Fading it in AND then
    // fading the real content in separately right after is what caused the
    // double-fade stutter this replaced.
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: QUIZ_CREAM_BG }}>
        <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (disqualified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden" style={{ background: QUIZ_CREAM_BG }}>
        <div className="relative z-10">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-10 mb-10 mx-auto brightness-0" />
          <p className="text-navy/50 text-xs tracking-[0.2em] uppercase font-sans mb-4">Not available yet</p>
          <h1 className="font-serif text-4xl text-navy mb-4">Not in Auckland yet?</h1>
          <p className="font-sans text-navy/60 max-w-md mb-8 leading-relaxed">
            We are currently curating dinners only in Auckland. Drop your email and we'll let you know when we expand to your city.
          </p>
          <a href="/" className="inline-block border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream">Back to HeyDer</a>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen relative overflow-hidden"
      style={{ background: QUIZ_CREAM_BG }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: 'easeInOut' }}
    >
      {/* Header */}
      <div
        className="relative z-20 flex items-center justify-between px-6 pb-5 border-b border-navy/10"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <a href="/"><img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-8 brightness-0" /></a>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span key={savedAt} className="font-sans text-navy/40 text-[11px] tracking-wide animate-[fadeOut_2.5s_ease-in-out_forwards]">
              ✓ Saved
            </span>
          )}
          <span className="font-sans text-navy/50 text-xs tracking-widest uppercase">{completionPct}% complete</span>
          <div className="relative flex-shrink-0">
            <label
              className="relative w-9 h-9 rounded-full border-2 border-dashed border-navy/30 bg-navy/5 flex items-center justify-center overflow-hidden hover:border-navy/60 transition-colors cursor-pointer"
              aria-label="Add profile photo"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handlePhotoSelect(e.target.files?.[0])}
              />
              {photoUploading ? (
                <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />
              ) : answers.photo ? (
                <img src={answers.photo} alt="Your profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm">📷</span>
              )}
            </label>

            {/* Comic-style speech bubble, pops down from the avatar — purely
                informational, stays open until the x is clicked; clicking
                the camera itself (not this bubble) is what opens the picker */}
            <AnimatePresence>
              {showPhotoBubble && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                  className="absolute top-full right-0 mt-3 z-50 origin-top-right"
                >
                  <div className="relative bg-white border-2 border-navy/30 rounded-xl pl-4 pr-9 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] whitespace-nowrap">
                    <div className="absolute -top-[7px] right-5 w-3 h-3 bg-white border-t-2 border-l-2 border-navy/30 rotate-45" />
                    <span className="font-sans text-navy text-sm">
                      {answers.photo ? 'Change profile pic' : 'Upload a profile pic'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPhotoBubble(false)}
                      className="absolute top-1 right-1 text-navy/50 hover:text-navy text-xl leading-none w-6 h-6 flex items-center justify-center"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="relative z-10 h-[2px] bg-navy/10">
        <div
          className="h-full bg-navy transition-all duration-500 ease-out"
          style={{ width: `${completionPct}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        {chapterTitle && (
          <motion.p
            key={chapterTitle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative z-10 max-w-xl mx-auto px-6 pt-10 text-navy/70 text-lg"
            style={{ fontFamily: "'Permanent Marker', cursive" }}
          >
            {chapterTitle}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
      <motion.div
        key={stepIndex}
        // The very first screen (arriving fresh from Home's fade-out) gets a
        // slow, plain opacity blend that matches the page-level fade above
        // it — no horizontal slide, so it reads as one continuous reveal
        // rather than a quick slide-in landing on top of a slower fade.
        // Every step after that keeps the snappier slide used for moving
        // through the questions.
        initial={stepIndex === 0 ? { opacity: 0 } : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={stepIndex === 0 ? { duration: 1, ease: 'easeInOut' } : { duration: 0.22, ease: 'easeOut' }}
        className={`relative z-10 max-w-xl mx-auto px-6 pb-10 space-y-8 ${chapterTitle ? 'pt-4' : 'pt-10'}`}
      >
        {step.type === 'question' && (
          <div className="min-h-[55vh]">
            {(() => {
              const q = step.question;
              const qNumber = stepIndex + 1;

              if (q.type === 'contact') {
                return (
                  <div id="q-contact" className="w-full">
                    <QuestionShell number={qNumber} title={q.title} required={q.required} error={errors.phone} titleFont="marker">
                      <div className="flex gap-2 max-w-sm">
                        <GlassSelect
                          value={answers.phoneCountryCode || '+64'}
                          onChange={v => setValue('phoneCountryCode', v)}
                          options={DIAL_CODES.map(([, code]) => code)}
                          placeholder="+64"
                          className="w-24 flex-shrink-0"
                        />
                        <input
                          type="tel"
                          inputMode="numeric"
                          placeholder="Phone number"
                          value={answers.phone || ''}
                          onChange={e => setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          maxLength={10}
                          className={`portal-login-input flex-1 ${errors.phone ? 'border-red-400/60' : ''}`}
                        />
                      </div>
                      {errors.phone && (
                        <p className="font-sans text-red-400/80 text-xs mt-1.5">
                          {answers.phone ? 'Enter a valid phone number.' : 'A phone number is required.'}
                        </p>
                      )}
                      <OkButton onClick={goNext} />
                    </QuestionShell>
                  </div>
                );
              }

              if (q.type === 'personal') {
                return (
                  // Each sub-field gets its own red border + asterisk instead
                  // of tinting the whole card red on any single error — an
                  // invalid DOB was visually flagging gender/country too even
                  // though they were filled in correctly.
                  <div id="q-personal" className="w-full">
                    <QuestionShell number={qNumber} title={q.title} required error={errors.dob || errors.gender || errors.country} titleFont="marker">
                      <div className="space-y-3 max-w-sm">
                        <div>
                          <label className="font-sans text-navy/50 text-xs tracking-[0.1em] uppercase mb-1.5 block">Date of birth <span className="text-navy/40">*</span></label>
                          <input
                            type="date"
                            value={answers.dob || ''}
                            onChange={e => setValue('dob', e.target.value)}
                            min={MIN_DOB}
                            max={MAX_DOB}
                            className={`portal-login-input ${errors.dob ? 'border-red-400/60' : ''}`}
                          />
                          {errors.dob && answers.dob && (
                            <p className="font-sans text-red-400/80 text-xs mt-1.5">You must be 18 or older to join HeyDer.</p>
                          )}
                        </div>
                        <div>
                          <label className="font-sans text-navy/50 text-xs tracking-[0.1em] uppercase mb-1.5 block">Gender <span className="text-navy/40">*</span></label>
                          <GlassSelect
                            value={answers.gender || ''}
                            onChange={v => setValue('gender', v)}
                            options={['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say']}
                            placeholder="Select gender"
                            error={errors.gender}
                          />
                        </div>
                        <div>
                          <label className="font-sans text-navy/50 text-xs tracking-[0.1em] uppercase mb-1.5 block">Country of origin <span className="text-navy/40">*</span></label>
                          <GlassSelect
                            value={answers.country || ''}
                            onChange={v => setValue('country', v)}
                            options={COUNTRIES}
                            placeholder="Select country"
                            error={errors.country}
                          />
                        </div>
                      </div>
                      <OkButton onClick={goNext} />
                    </QuestionShell>
                  </div>
                );
              }

              return (
                <div id={`q-${q.id}`} className="w-full">
                  <QuestionShell number={qNumber} title={q.title} required={q.required} description={q.description} error={errors[q.field]}>
                    <QuestionField
                      q={q}
                      value={answers[q.field]}
                      onChange={(v) => handleFieldAnswer(q, v)}
                      otherValue={q.otherField ? answers[q.otherField] : undefined}
                      onOtherChange={q.otherField ? (v) => setValue(q.otherField, v) : undefined}
                    />
                    <OkButton onClick={goNext} />
                  </QuestionShell>
                </div>
              );
            })()}
          </div>
        )}

        {step.type === 'date' && (
          <div className="min-h-[40vh] flex flex-col justify-center gap-8">
            <div id="q-date" className={`${errors.field_CdZldwp5q09o ? 'rounded-2xl -mx-4 px-4 py-4 bg-red-500/5' : ''}`}>
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif font-bold text-xl text-navy mb-6">{DATE_Q.title}</motion.p>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDateOptionsOpen(o => !o)}
                  className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 font-sans text-base text-navy transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.35)',
                    backdropFilter: 'blur(10px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(10px) saturate(140%)',
                    border: '1px solid rgba(22,24,29,0.12)',
                    boxShadow: '0 6px 18px rgba(22,24,29,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                  }}
                >
                  <span className={answers.field_CdZldwp5q09o ? 'text-navy' : 'text-navy/40'}>
                    {answers.field_CdZldwp5q09o || 'Select a Tuesday'}
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    className="text-navy/50 transition-transform duration-200 flex-shrink-0"
                    style={{ transform: dateOptionsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {dateOptionsOpen && (
                  <div
                    className="absolute left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-10"
                    style={{
                      background: 'rgba(231,223,197,0.9)',
                      backdropFilter: 'blur(10px) saturate(140%)',
                      WebkitBackdropFilter: 'blur(10px) saturate(140%)',
                      border: '1px solid rgba(22,24,29,0.12)',
                      boxShadow: '0 10px 28px rgba(22,24,29,0.12)',
                    }}
                  >
                    {dateChoices.map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => { setValue('field_CdZldwp5q09o', choice); setDateOptionsOpen(false); }}
                        className="w-full text-left px-5 py-3 font-sans text-sm text-navy hover:bg-navy/5 transition-colors"
                      >
                        {choice}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setDateOptionsOpen(false); skipPayment(true); }}
                      disabled={submitting}
                      className="w-full text-left px-5 py-3 font-sans text-sm text-navy/55 hover:bg-navy/5 transition-colors border-t border-navy/10 disabled:opacity-50"
                    >
                      Not sure yet — I'll choose later
                    </button>
                  </div>
                )}
              </div>

              <p className="font-sans text-navy/40 text-[11px] text-center mt-3">
                Your profile is saved — book a Tuesday whenever you're ready.
              </p>

              {answers.field_CdZldwp5q09o && (
                <div className="flex justify-center mt-6">
                  <button onClick={goNext} className="border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-3 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream">
                    Continue to payment →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step.type === 'payment' && (
          <div>
            <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif font-bold text-xl text-navy mb-4">Reserve your spot</motion.p>

            {hasActiveSubscription ? (
              <div>
                <div className="rounded-xl border border-navy/20 bg-navy/5 p-4 mb-4 text-center">
                  <p className="font-sans text-navy/70 text-sm">✓ You're covered by your monthly membership — no extra charge.</p>
                </div>
                <button
                  onClick={() => submitQuizWithoutPayment()}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream disabled:opacity-60"
                >
                  {submitting ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            ) : (() => {
              // No discount is shown or applied up front — only a coupon
              // (an explicit user action) changes the price here. The
              // automatic 10% is a retention offer that only appears in the
              // "Skip for now" popup below, never before that.
              const discountPercent = appliedCoupon ? appliedCoupon.discountPercent : 0;
              const baseOneTime = pricing.oneTimeAmount / 100;
              const baseSub = pricing.subscriptionAmount / 100;
              const oneTimePrice = (baseOneTime * (1 - discountPercent / 100)).toFixed(2).replace(/\.00$/, '');
              const subPrice = (baseSub * (1 - discountPercent / 100)).toFixed(2).replace(/\.00$/, '');
              return (
                <div>
                  <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="space-y-3 mb-4">
                    <motion.button
                      variants={fadeLeftVariant}
                      type="button"
                      onClick={() => setSelectedPlan('one_time')}
                      className="portal-login-input w-full text-left block transition-all duration-200"
                      style={selectedPlan === 'one_time' ? { borderColor: '#16181d', background: 'rgba(255,255,255,0.5)' } : undefined}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-sans font-semibold text-base">One-time reservation</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className="font-sans text-xs line-through text-navy/35">${baseOneTime.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${oneTimePrice}</span>
                        </span>
                      </div>
                      {selectedPlan === 'one_time' && (
                        <p className="font-sans text-sm text-navy/55">
                          Reserve {answers.field_CdZldwp5q09o ? `the ${answers.field_CdZldwp5q09o}` : "this Tuesday's"} dinner.
                        </p>
                      )}
                    </motion.button>
                    <motion.button
                      variants={fadeLeftVariant}
                      type="button"
                      onClick={() => setSelectedPlan('subscription')}
                      className="portal-login-input w-full text-left block relative transition-all duration-200"
                      style={selectedPlan === 'subscription' ? { borderColor: '#16181d', background: 'rgba(255,255,255,0.5)' } : undefined}
                    >
                      <span className="absolute -top-2.5 right-5 bg-navy text-cream text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Best value</span>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-sans font-semibold text-base">Monthly membership</span>
                        <span className="flex items-baseline gap-1.5">
                          {discountPercent > 0 && (
                            <span className="font-sans text-xs line-through text-navy/35">${baseSub.toFixed(2).replace(/\.00$/, '')}</span>
                          )}
                          <span className="font-serif text-2xl">${subPrice}<span className="text-sm">/mo</span></span>
                        </span>
                      </div>
                      {selectedPlan === 'subscription' && (
                        <p className="font-sans text-sm text-navy/55">Unlimited HeyDer dinners this month.</p>
                      )}
                    </motion.button>
                  </motion.div>

                  {/* Coupon entry — an ambassador's code replaces the automatic
                      pay-now discount above rather than stacking with it. */}
                  <div className="mb-4">
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-600/30 bg-emerald-600/[0.08] px-3 py-2.5">
                        <span className="font-sans text-emerald-700 text-xs">
                          ✓ Code <span className="font-mono">{appliedCoupon.code}</span> applied — {appliedCoupon.discountPercent}% off
                        </span>
                        <button type="button" onClick={removeCoupon} className="font-sans text-navy/50 hover:text-navy text-xs transition-colors">Remove</button>
                      </div>
                    ) : (
                      <div>
                        <label className="font-sans text-navy/50 text-xs tracking-[0.1em] uppercase mb-1.5 block">Coupon code</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                            placeholder="Enter code"
                            className="flex-1 w-full border rounded-2xl px-5 py-3.5 font-sans text-base focus:outline-none transition-colors bg-transparent border-navy/30 text-navy placeholder-navy/35 focus:border-navy/60"
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            disabled={validatingCoupon || !couponInput.trim()}
                            className="border-2 border-navy text-navy font-sans font-semibold text-xs tracking-widest uppercase px-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream disabled:opacity-50"
                          >
                            {validatingCoupon ? '...' : 'Apply'}
                          </button>
                        </div>
                        {couponError && <p className="font-sans text-red-500 text-xs mt-1.5">{couponError}</p>}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handlePayment(selectedPlan)}
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 border-2 border-navy text-navy font-sans font-semibold text-sm tracking-widest uppercase px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream disabled:opacity-60"
                  >
                    {submitting
                      ? 'Processing...'
                      : !stripeConfigured
                        ? 'Complete Booking (Test Mode)'
                        : selectedPlan === 'subscription' ? `Subscribe $${subPrice}/mo` : `Pay $${oneTimePrice} & Complete Booking`}
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={() => setShowSkipDiscountModal(true)}
                      disabled={submitting}
                      className="font-sans text-navy/50 hover:text-navy text-xs transition-colors disabled:opacity-50"
                    >
                      Skip for now — set up my account
                    </button>
                  </div>
                </div>
              );
            })()}

            <p className="font-sans text-navy/40 text-[11px] text-center mt-5">
              By proceeding you are accepting our{' '}
              <a href="/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-navy underline hover:text-navy/60">terms &amp; conditions</a>
              {' '}/{' '}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-navy underline hover:text-navy/60">privacy policy</a>.
            </p>
          </div>
        )}

        {/* Shown only when someone tries to skip — the 10% incentive is a
            retention offer for that moment, never advertised up front. */}
        {showSkipDiscountModal && (
          <div className="fixed inset-0 z-50 bg-navy/80 backdrop-blur flex items-center justify-center p-6" onClick={() => setShowSkipDiscountModal(false)}>
            <div className="quiz-card max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
              <p className="text-3xl mb-3">🎁</p>
              {(() => {
                const modalDiscount = appliedCoupon ? appliedCoupon.discountPercent : SIGNUP_DISCOUNT_PERCENT;
                return (
                  <>
                    <p className="font-serif text-xl text-cream mb-2">Wait — pay now and save {modalDiscount}%?</p>
                    <p className="font-sans text-cream/50 text-sm mb-6">
                      Reserve today instead of skipping and we'll knock {modalDiscount}% off {selectedPlan === 'subscription' ? 'your first month' : "this Tuesday's dinner"}.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setShowSkipDiscountModal(false); handlePayment(selectedPlan, true); }}
                      disabled={submitting}
                      className="quiz-cta w-full mb-3 disabled:opacity-60"
                    >
                      Pay now & save {modalDiscount}%
                    </button>
                  </>
                );
              })()}
              <button
                type="button"
                onClick={() => { setShowSkipDiscountModal(false); skipPayment(); }}
                disabled={submitting}
                className="font-sans text-cream/40 hover:text-cream text-xs transition-colors disabled:opacity-50"
              >
                Skip anyway
              </button>
            </div>
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {stepIndex > 0 ? (
            <button onClick={goBack} className="font-sans text-navy/60 hover:text-navy text-sm px-2 py-3 transition-colors">
              ← Back
            </button>
          ) : <span />}
        </div>
      </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
