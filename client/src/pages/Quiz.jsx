import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export const CHAPTERS = [
  { id: 'basics', title: 'The Basics', blurb: 'Quick logistics so we know where and when to seat you.' },
  { id: 'vibe', title: 'Your Vibe', blurb: 'No wrong answers here — just be honest.' },
  { id: 'connect', title: 'How You Connect', blurb: "The stuff that actually matters once you're at the table." },
  { id: 'draws_in', title: 'What Draws You In', blurb: 'Getting into the good stuff now.' },
  { id: 'favourites', title: 'A Few Favourites', blurb: 'Small details that make the night feel right.' },
  { id: 'you', title: 'Just About You', blurb: "Last step — then we'll go build your table." },
];

export const QUESTIONS = [
  { id: 'chapter_basics', type: 'chapter_intro', chapterId: 'basics' },
  {
    id: 'auckland',
    type: 'yes_no',
    title: 'Are you in Auckland?',
    description: 'We are currently curating dinners only in Auckland.',
    field: 'field_iunObNMC8bY1',
    chapter: 'basics',
    required: true,
    disqualifyIfNo: true,
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
    title: "What's your relationship status?",
    field: 'field_3zmnHXYzZn17',
    chapter: 'basics',
    required: true,
    choices: ['Single', 'Married', 'In a relationship', "It's complicated", 'Prefer not to say'],
  },
  {
    id: 'lifestage',
    type: 'choice',
    title: 'Which stage of life are you in right now?',
    field: 'field_aIpzE2elktbh',
    chapter: 'basics',
    required: true,
    choices: ['Not Working', 'Student', 'Building Foundations', 'Settled Professional', 'New to city'],
  },
  { id: 'chapter_vibe', type: 'chapter_intro', chapterId: 'vibe' },
  {
    id: 'personality',
    type: 'choice',
    title: 'Would you say you\'re more…',
    field: 'field_L6GblNns9C7v',
    chapter: 'vibe',
    required: true,
    choices: ['Outgoing', 'Reserved', 'Bit of both'],
  },
  {
    id: 'battery',
    type: 'choice',
    title: "How's your social battery these days?",
    field: 'field_LosYJHqrbpKO',
    chapter: 'vibe',
    required: true,
    choices: ['Never runs out', 'Need occasional charging', 'Drains pretty fast'],
  },
  {
    id: 'career_pref',
    type: 'choice',
    title: 'If paid equally, which career would you choose?',
    field: 'field_lS4ks7Km1VlA',
    chapter: 'vibe',
    required: true,
    choices: ['Rom-com actor', 'Counsellor', 'Stand up comedian', 'Life Coach'],
  },
  {
    id: 'deep_convo',
    type: 'scale',
    title: 'I enjoy having deep conversations in a group',
    field: 'field_PyYcCusA8b74',
    chapter: 'vibe',
    required: true,
    min: 0, max: 10,
    labels: ['Disagree', 'Strongly agree'],
  },
  {
    id: 'sarcastic',
    type: 'scale',
    title: 'I am sarcastic in nature',
    field: 'field_Y8VLrSMSZLmb',
    chapter: 'vibe',
    required: true,
    min: 0, max: 10,
    labels: ['Not at all', 'Very much so'],
  },
  { id: 'chapter_connect', type: 'chapter_intro', chapterId: 'connect' },
  {
    id: 'financial',
    type: 'scale',
    title: 'Financial security comes first',
    field: 'field_heE41fid4m48',
    chapter: 'connect',
    required: true,
    min: 0, max: 10,
    labels: ['Disagree', 'Strongly agree'],
  },
  {
    id: 'initiate',
    type: 'scale',
    title: 'I usually initiate plans',
    field: 'field_H4KwwtKh8sYF',
    chapter: 'connect',
    required: true,
    min: 0, max: 10,
    labels: ['Never', 'Always'],
  },
  {
    id: 'curious',
    type: 'scale',
    title: 'You straight up ask questions when curious',
    field: 'field_OqnhJdRIytBz',
    chapter: 'connect',
    required: true,
    min: 0, max: 10,
    labels: ['No, I wait', 'Yes, immediately'],
  },
  {
    id: 'reliability',
    type: 'scale',
    title: 'How important is reliability to you?',
    field: 'field_1NDB7q3CaeDQ',
    chapter: 'connect',
    required: true,
    min: 0, max: 10,
    labels: ['Not important', 'Critical'],
  },
  {
    id: 'social_circle',
    type: 'choice',
    title: 'My social circle is',
    field: 'field_TaGZoiuhOhh2',
    chapter: 'connect',
    required: true,
    choices: ['Small but close', 'Decent but need depth', 'Mostly online', 'Pretty much none'],
  },
  { id: 'chapter_draws_in', type: 'chapter_intro', chapterId: 'draws_in' },
  {
    id: 'group_role',
    type: 'choice',
    title: 'In a group, you naturally become the one who…',
    field: 'group_role',
    chapter: 'draws_in',
    required: true,
    choices: [
      'Comes up with the wild ideas',
      'Keeps everyone on track',
      "Makes sure no one's left out",
      'Pushes the group to actually decide something',
      'Asks the smart, cautious questions',
      'Knows someone for everything',
    ],
  },
  {
    id: 'conflict_style',
    type: 'choice',
    title: "When there's tension in a group, you usually…",
    field: 'conflict_style',
    chapter: 'draws_in',
    required: true,
    choices: ['Address it head on', 'Smooth it over with humour', 'Wait it out', 'Play mediator'],
  },
  {
    id: 'connection_trigger',
    type: 'choice',
    title: 'You feel instantly connected to someone who…',
    field: 'connection_trigger',
    chapter: 'draws_in',
    required: true,
    choices: ['Makes you laugh', 'Asks real questions', 'Shares a niche interest', 'Is unapologetically themselves'],
  },
  {
    id: 'social_recharge',
    type: 'scale',
    title: 'The day after a big night out, you feel',
    field: 'social_recharge',
    chapter: 'draws_in',
    required: true,
    min: 0, max: 10,
    labels: ['Wiped out', 'Recharged'],
  },
  {
    id: 'conversation_avoid',
    type: 'choice',
    title: 'The conversation you try to avoid most',
    field: 'conversation_avoid',
    chapter: 'draws_in',
    required: true,
    choices: ['Small talk', 'Oversharing too soon', 'Debating opinions', 'Talking about work'],
  },
  {
    id: 'first_meeting_style',
    type: 'choice',
    title: 'Meeting someone new, you usually…',
    field: 'first_meeting_style',
    chapter: 'draws_in',
    required: true,
    choices: ['Ask lots of questions', 'Wait for them to open up', 'Crack a joke to break the ice', 'Just vibe and see what happens'],
  },
  { id: 'chapter_favourites', type: 'chapter_intro', chapterId: 'favourites' },
  {
    id: 'topics',
    type: 'choice',
    title: 'What do you love talking about?',
    field: 'field_TQFTxLhIZnOf',
    chapter: 'favourites',
    required: true,
    choices: ['Pop Culture', 'Sports', 'Politics'],
  },
  {
    id: 'weekends',
    type: 'choice',
    title: 'Most weekends, you are…',
    field: 'field_pCwGXuvIxGTu',
    chapter: 'favourites',
    required: true,
    choices: ['Out with people', 'Family time', 'Solo recharging', 'Hobby engagement'],
  },
  {
    id: 'career_desc',
    type: 'text',
    title: 'How would you describe your career/job to a kid?',
    field: 'field_MQDZqx7wid2f',
    chapter: 'favourites',
    required: true,
    placeholder: 'Be creative...',
  },
  {
    id: 'budget',
    type: 'choice',
    title: "What's your budget for the set menu?",
    description: 'All restaurants are rated 4.3+ and cater to allergen requirements',
    field: 'field_Ar4xQbXT6CLh',
    chapter: 'favourites',
    required: true,
    choices: ['$45-$50', '$50-$55'],
  },
  {
    id: 'dietary',
    type: 'multi_choice',
    title: 'Any dietary preferences we should know?',
    field: 'field_OVB7lzEjSl7C',
    chapter: 'favourites',
    required: false,
    choices: ['Not Applicable', 'Gluten free', 'Dairy free', 'Nut free', 'Vegan', 'Vegetarian'],
  },
  { id: 'chapter_you', type: 'chapter_intro', chapterId: 'you' },
  {
    id: 'contact',
    type: 'contact',
    title: "What's the best number to reach you on?",
    chapter: 'you',
    required: false,
  },
  {
    id: 'personal',
    type: 'personal',
    title: 'Just a few more details',
    chapter: 'you',
    required: true,
  },
  { id: 'profile_complete', type: 'celebration' },
  {
    id: 'date',
    type: 'choice',
    title: 'Which Tuesday night works for you?',
    description: 'Your profile is set — now let\'s pick your night',
    field: 'field_CdZldwp5q09o',
    required: true,
    choices: ['30th June 2026', '7th July 2026'],
  },
  {
    id: 'payment',
    type: 'payment',
    title: 'Reserve your spot',
    description: 'Choose how you\'d like to join — refundable with 48hrs notice.',
  },
];

const COUNTRIES = [
  'New Zealand', 'Australia', 'India', 'United Kingdom', 'United States',
  'China', 'Philippines', 'South Africa', 'Canada', 'Fiji', 'Samoa', 'Tonga',
  'South Korea', 'Japan', 'Singapore', 'Malaysia', 'Sri Lanka', 'Bangladesh',
  'Pakistan', 'Nepal', 'Germany', 'France', 'Italy', 'Netherlands', 'Ireland',
  'Brazil', 'Colombia', 'Mexico', 'Zimbabwe', 'Nigeria', 'Ghana', 'Kenya',
  'Other',
];

const ROLE_SHORT = {
  'Comes up with the wild ideas': 'Ideas person',
  'Keeps everyone on track': 'Organizer',
  "Makes sure no one's left out": 'Includer',
  'Pushes the group to actually decide something': 'Closer',
  'Asks the smart, cautious questions': 'Analyst',
  'Knows someone for everything': 'Connector',
};

/* ── Button styles: cream/champagne on navy, solid inversion when selected ── */
const choiceBase =
  'w-full text-left px-5 py-[14px] rounded-2xl border font-sans text-base transition-all duration-200 flex items-center justify-between cursor-pointer';
const choiceIdle =
  'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95';
const choiceActive =
  'border-gold bg-gold text-navy shadow-[0_8px_32px_rgba(232,168,84,0.25)]';

const ChoiceTick = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 ml-3">
    <circle cx="8" cy="8" r="7.5" stroke="#16181d" strokeWidth="1" strokeOpacity="0.3" />
    <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#16181d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A little "level up" stepper across the 6 profile chapters — turns the
// abstract progress bar into something that feels like clearing stages,
// not just a percentage ticking up.
function ChapterStepper({ currentChapterIndex }) {
  if (currentChapterIndex < 0) return null;
  return (
    <div className="flex items-center justify-center gap-1.5">
      {CHAPTERS.map((c, i) => {
        const done = i < currentChapterIndex;
        const active = i === currentChapterIndex;
        return (
          <React.Fragment key={c.id}>
            <div
              title={c.title}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-sans font-bold transition-all duration-300 ${
                done
                  ? 'bg-gold text-navy'
                  : active
                    ? 'border-2 border-gold text-gold scale-110'
                    : 'border border-cream/15 text-cream/25'
              }`}
            >
              {done ? '✓' : i + 1}
            </div>
            {i < CHAPTERS.length - 1 && (
              <div className={`w-3 h-px transition-colors duration-300 ${done ? 'bg-gold' : 'bg-cream/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Returning attendee with a complete profile skips straight to Tuesday selection + payment.
const RETURNING_STEP_IDS = ['date', 'payment'];

export default function Quiz() {
  const navigate = useNavigate();
  const { attendeeUser } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [transitioning, setTransitioning] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [errors, setErrors] = useState({});
  const [returning, setReturning] = useState(null); // null = loading profile, true/false once known
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  useEffect(() => {
    api.get('/portal/full-profile')
      .then(res => {
        const { locked, profileComplete, hasActiveSubscription: hasSub, answers: savedAnswers } = res.data;
        setAnswers(prev => ({
          ...prev,
          first_name: locked.first_name,
          last_name: locked.last_name,
          phone: locked.phone,
          dob: locked.dob,
          gender: locked.gender,
          country: locked.country,
          ...savedAnswers,
        }));
        setHasActiveSubscription(!!hasSub);
        setReturning(!!profileComplete);
      })
      .catch(() => setReturning(false));
  }, []);

  const steps = useMemo(
    () => (returning === true ? QUESTIONS.filter(q => RETURNING_STEP_IDS.includes(q.id)) : QUESTIONS),
    [returning]
  );

  const totalSteps = steps.length;
  const current = returning === null ? null : steps[step];
  const progress = current ? (step / (totalSteps - 1)) * 100 : 0;
  const firstName = answers.first_name?.trim();

  const chapter = current?.chapter ? CHAPTERS.find(c => c.id === current.chapter) : null;
  const headerLabel = !current || ['chapter_intro', 'payment', 'celebration'].includes(current.type)
    ? ''
    : chapter
      ? chapter.title
      : current.id === 'date'
        ? 'Booking'
        : '';

  // Which chapter "level" the attendee is currently on, for the stepper below —
  // once past all chapters (celebration/date/payment), everything reads as done.
  const chapterKey = current?.chapter || current?.chapterId || null;
  const currentChapterIndex = chapterKey
    ? CHAPTERS.findIndex(c => c.id === chapterKey)
    : current ? CHAPTERS.length : -1;

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
    if (answers.group_role) chips.push({ icon: '✦', label: ROLE_SHORT[answers.group_role] || answers.group_role });
    return chips;
  }, [firstName, answers.field_cqCcs6psQuhE, answers.field_L6GblNns9C7v, answers.group_role]);

  const setValue = (field, value) => setAnswers(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!current.required) return true;

    if (current.type === 'personal') {
      const errs = {};
      if (!answers.dob?.trim()) errs.dob = 'Required';
      if (!answers.gender?.trim()) errs.gender = 'Required';
      if (!answers.country?.trim()) errs.country = 'Required';
      setErrors(errs);
      return Object.keys(errs).length === 0;
    }

    const val = answers[current.field];
    return val !== undefined && val !== '' && val !== null;
  };

  const next = () => {
    if (!validate()) {
      toast.error('Please answer this question to continue.');
      return;
    }
    setErrors({});

    if (current.disqualifyIfNo && answers[current.field] === false) {
      setDisqualified(true);
      return;
    }

    if (step < totalSteps - 1) {
      setTransitioning(true);
      setTimeout(() => { setStep(s => s + 1); setTransitioning(false); }, 200);
    }
  };

  const handleSelect = (field, value) => {
    setValue(field, value);
    if (current.disqualifyIfNo && value === false) {
      setTimeout(() => setDisqualified(true), 300);
      return;
    }
    if (step < totalSteps - 1) {
      setTransitioning(true);
      setTimeout(() => { setStep(s => s + 1); setTransitioning(false); }, 300);
    }
  };

  const prev = () => {
    if (step > 0) {
      setTransitioning(true);
      setTimeout(() => { setStep(s => s - 1); setTransitioning(false); }, 200);
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'Enter' || !current) return;
    if (current.type !== 'text') next();
  }, [step, answers, current]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePayment = async (plan) => {
    setSubmitting(true);
    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        await submitQuizWithoutPayment();
        return;
      }
      const stripe = await loadStripe(stripeKey);
      const res = await api.post('/payments/create-checkout', {
        email: attendeeUser?.email,
        plan,
        metadata: { quizData: JSON.stringify(answers) },
      });
      sessionStorage.setItem('heyder_quiz_answers', JSON.stringify(answers));
      await stripe.redirectToCheckout({ sessionId: res.data.sessionId });
    } catch (err) {
      toast.error('Payment setup failed. Please try again.');
      setSubmitting(false);
    }
  };

  const submitQuizWithoutPayment = async () => {
    try {
      await api.post('/profile/submit', {
        ...answers,
        field_OVB7lzEjSl7C: answers.field_OVB7lzEjSl7C || [],
      });
      navigate('/profile/success');
    } catch (err) {
      toast.error('Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (returning === null) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (disqualified) {
    return (
      <div className="quiz-bg min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        <div className="relative z-10">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-10 mb-10 mx-auto" />
          <p className="text-gold/60 text-xs tracking-[0.2em] uppercase font-sans mb-4">Not available yet</p>
          <h1 className="font-serif text-4xl text-cream mb-4">Not in Auckland yet?</h1>
          <p className="font-sans text-cream/50 max-w-md mb-8 leading-relaxed">
            We are currently curating dinners only in Auckland. Drop your email and we'll let you know when we expand to your city.
          </p>
          <a href="/" className="btn-primary">Back to HeyDer</a>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-bg min-h-screen flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
        <a href="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-8" />
        </a>
        <div className="flex items-center gap-3">
          {headerLabel && (
            <span className="font-sans text-cream/30 text-xs tracking-widest uppercase">
              {headerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 h-[2px] bg-white/[0.05]">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #E8A854 0%, #f0c040 100%)',
          }}
        />
      </div>

      {/* Chapter stepper — the "level up" indicator */}
      {currentChapterIndex >= 0 && (
        <div className="relative z-10 pt-5 px-6">
          <ChapterStepper currentChapterIndex={currentChapterIndex} />
          <p className="text-center font-sans text-cream/25 text-[10px] tracking-[0.2em] uppercase mt-2">
            {Math.round(progress)}% profile complete
          </p>
        </div>
      )}

      {/* Profile-in-progress chip strip */}
      {profileChips.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-2 px-6 pt-4 max-w-lg mx-auto w-full justify-center">
          {profileChips.map((c, i) => (
            <span
              key={i}
              className="text-xs px-3 py-1 rounded-full border border-gold/20 bg-gold/5 text-cream/60 flex items-center gap-1.5"
            >
              <span>{c.icon}</span>{c.label}
            </span>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 transition-all duration-200 ${
          transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="w-full max-w-lg">

          {/* ── CHAPTER COVER ── */}
          {current.type === 'chapter_intro' && (() => {
            const chapIndex = CHAPTERS.findIndex(c => c.id === current.chapterId);
            const chap = CHAPTERS[chapIndex];
            return (
              <div className="text-center">
                <p className="font-sans text-gold/60 text-xs tracking-[0.25em] uppercase mb-4">
                  Chapter {chapIndex + 1} of {CHAPTERS.length}
                </p>
                <h2 className="font-serif text-4xl md:text-5xl text-cream mb-4">{chap.title}</h2>
                <p className="font-sans text-cream/50 mb-10 max-w-sm mx-auto leading-relaxed">
                  {chapIndex === 0 && firstName ? `Nice to meet you, ${firstName}. ${chap.blurb}` : chap.blurb}
                </p>
                <button onClick={next} className="quiz-cta px-10">Let's go →</button>
              </div>
            );
          })()}

          {current.type !== 'chapter_intro' && current.type !== 'celebration' && (
            <>
              {/* Question label */}
              {current.description && (
                <p className="font-sans text-gold/70 text-xs tracking-[0.18em] uppercase mb-3">
                  {current.description}
                </p>
              )}

              {/* Question heading */}
              <h2 className="font-serif text-3xl md:text-4xl text-cream mb-8 leading-tight">
                {current.title}
              </h2>
            </>
          )}

          {/* ── PROFILE COMPLETE CELEBRATION ── */}
          {current.type === 'celebration' && (
            <div className="text-center">
              <p className="text-5xl mb-5">🎉</p>
              <h2 className="font-serif text-4xl md:text-5xl text-cream mb-4">Profile complete!</h2>
              <p className="font-sans text-cream/50 mb-8 max-w-sm mx-auto leading-relaxed">
                {firstName ? `Nice work, ${firstName}.` : 'Nice work.'} Here's what you've told us so far — next, let's pick your Tuesday.
              </p>
              {profileChips.length > 0 && (
                <div className="flex flex-wrap gap-2.5 justify-center mb-10">
                  {profileChips.map((c, i) => (
                    <span
                      key={i}
                      className="text-sm px-4 py-2 rounded-full border border-gold/25 bg-gold/10 text-cream/80 flex items-center gap-2"
                    >
                      <span>{c.icon}</span>{c.label}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={next} className="quiz-cta px-10">Pick my Tuesday →</button>
            </div>
          )}

          {/* ── YES / NO ── */}
          {current.type === 'yes_no' && (
            <div className="flex gap-3">
              {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => handleSelect(current.field, opt.value)}
                  className={`flex-1 py-5 rounded-2xl border font-sans font-medium text-base transition-all duration-200 tracking-wide ${
                    answers[current.field] === opt.value
                      ? 'border-gold bg-gold text-navy shadow-[0_8px_32px_rgba(232,168,84,0.25)]'
                      : 'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* ── SINGLE CHOICE ── */}
          {current.type === 'choice' && (
            <div className="space-y-2.5">
              {current.choices.map(choice => {
                const isActive = answers[current.field] === choice;
                return (
                  <button
                    key={choice}
                    onClick={() => handleSelect(current.field, choice)}
                    className={`${choiceBase} ${isActive ? choiceActive : choiceIdle}`}
                  >
                    <span>{choice}</span>
                    {isActive && <ChoiceTick />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── MULTI CHOICE ── */}
          {current.type === 'multi_choice' && (
            <div className="space-y-2.5">
              {current.choices.map(choice => {
                const selected = (answers[current.field] || []).includes(choice);
                return (
                  <button
                    key={choice}
                    onClick={() => {
                      const cur = answers[current.field] || [];
                      if (choice === 'Not Applicable') {
                        setValue(current.field, ['Not Applicable']);
                      } else {
                        const filtered = cur.filter(c => c !== 'Not Applicable');
                        setValue(current.field, selected
                          ? filtered.filter(c => c !== choice)
                          : [...filtered, choice]
                        );
                      }
                    }}
                    className={`${choiceBase} ${selected ? choiceActive : choiceIdle}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                        selected ? 'border-navy/30 bg-navy/10' : 'border-[#e7dcbd]/20'
                      }`}>
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="#16181d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {choice}
                    </span>
                  </button>
                );
              })}
              <button onClick={next} className="quiz-cta w-full mt-5">
                Continue →
              </button>
            </div>
          )}

          {/* ── SCALE ── */}
          {current.type === 'scale' && (
            <div>
              <div className="flex justify-between mb-4">
                <span className="font-sans text-[#e7dcbd]/35 text-xs tracking-wide">{current.labels?.[0]}</span>
                <span className="font-sans text-[#e7dcbd]/35 text-xs tracking-wide">{current.labels?.[1]}</span>
              </div>
              <div className="flex gap-1.5 justify-between">
                {Array.from({ length: current.max - current.min + 1 }, (_, i) => i + current.min).map(n => {
                  const isActive = answers[current.field] === n;
                  return (
                    <button
                      key={n}
                      onClick={() => handleSelect(current.field, n)}
                      className={`flex-1 aspect-square max-w-[46px] rounded-full font-sans text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-gold text-navy shadow-[0_4px_20px_rgba(232,168,84,0.3)] scale-110'
                          : 'border border-[#e7dcbd]/15 bg-[#e7dcbd]/[0.03] text-[#e7dcbd]/40 hover:border-[#e7dcbd]/40 hover:text-[#e7dcbd]/90 hover:bg-[#e7dcbd]/[0.07] hover:scale-105'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {answers[current.field] !== undefined && (
                <p className="text-center mt-4 font-sans text-[#e7dcbd]/40 text-xs tracking-widest uppercase">
                  {answers[current.field]} / {current.max}
                </p>
              )}
            </div>
          )}

          {/* ── TEXT ── */}
          {current.type === 'text' && (
            <div>
              <textarea
                value={answers[current.field] || ''}
                onChange={e => setValue(current.field, e.target.value)}
                placeholder={current.placeholder}
                rows={4}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-cream placeholder-cream/25 font-sans text-base focus:outline-none focus:border-gold/50 focus:bg-gold/[0.03] transition-all resize-none"
              />
              <button onClick={next} className="quiz-cta w-full mt-4">
                Continue →
              </button>
            </div>
          )}

          {/* ── CONTACT ── */}
          {current.type === 'contact' && (
            <div className="space-y-3">
              <input
                type="tel"
                placeholder="Phone number"
                value={answers.phone || ''}
                onChange={e => setValue('phone', e.target.value)}
                className="quiz-input"
                autoFocus
              />
              <button onClick={next} className="quiz-cta w-full mt-2">
                Continue →
              </button>
            </div>
          )}

          {/* ── PERSONAL ── */}
          {current.type === 'personal' && (
            <div className="space-y-4">
              <div>
                <label className="font-sans text-cream/40 text-xs tracking-[0.15em] uppercase mb-2 block">Date of birth *</label>
                <input
                  type="date"
                  value={answers.dob || ''}
                  onChange={e => setValue('dob', e.target.value)}
                  className={`quiz-input ${errors.dob ? 'border-red-400/50' : ''}`}
                />
                {errors.dob && <p className="text-red-400 text-xs mt-1">{errors.dob}</p>}
              </div>
              <div>
                <label className="font-sans text-cream/40 text-xs tracking-[0.15em] uppercase mb-2 block">Gender *</label>
                <select
                  value={answers.gender || ''}
                  onChange={e => setValue('gender', e.target.value)}
                  className={`quiz-input ${errors.gender ? 'border-red-400/50' : ''}`}
                >
                  <option value="">Select gender</option>
                  {['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
              </div>
              <div>
                <label className="font-sans text-cream/40 text-xs tracking-[0.15em] uppercase mb-2 block">Country of origin *</label>
                <select
                  value={answers.country || ''}
                  onChange={e => setValue('country', e.target.value)}
                  className={`quiz-input ${errors.country ? 'border-red-400/50' : ''}`}
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.country && <p className="text-red-400 text-xs mt-1">{errors.country}</p>}
              </div>
              <button onClick={next} className="quiz-cta w-full mt-2">
                Continue →
              </button>
            </div>
          )}

          {/* ── PAYMENT ── */}
          {current.type === 'payment' && hasActiveSubscription && (
            <div>
              <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.1] to-white/[0.02] p-6 mb-5 text-center">
                <p className="text-3xl mb-2">✓</p>
                <p className="font-serif text-xl text-cream mb-2">You're covered by your membership</p>
                <p className="font-sans text-cream/50 text-sm leading-relaxed">
                  Your monthly membership includes unlimited HeyDer dinners — no extra charge for this Tuesday.
                </p>
              </div>
              <button
                onClick={() => { setSubmitting(true); submitQuizWithoutPayment(); }}
                disabled={submitting}
                className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-navy/60 border-t-transparent rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : 'Confirm Booking'}
              </button>
            </div>
          )}

          {current.type === 'payment' && !hasActiveSubscription && (
            <div>
              <div className="space-y-3 mb-5">
                <button
                  onClick={() => setSelectedPlan('one_time')}
                  className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 ${
                    selectedPlan === 'one_time' ? choiceActive : choiceIdle
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-base">One-time reservation</span>
                    <span className="font-serif text-2xl">$10</span>
                  </div>
                  <p className={`font-sans text-sm ${selectedPlan === 'one_time' ? 'text-navy/60' : 'text-cream/40'}`}>
                    Reserve just this Tuesday's dinner.
                  </p>
                </button>

                <button
                  onClick={() => setSelectedPlan('subscription')}
                  className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 relative ${
                    selectedPlan === 'subscription' ? choiceActive : choiceIdle
                  }`}
                >
                  <span className="absolute -top-2.5 right-5 bg-yellow text-navy text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                    Best value
                  </span>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans font-semibold text-base">Monthly membership</span>
                    <span className="font-serif text-2xl">$15<span className="text-sm">/mo</span></span>
                  </div>
                  <p className={`font-sans text-sm ${selectedPlan === 'subscription' ? 'text-navy/60' : 'text-cream/40'}`}>
                    Unlimited HeyDer dinners this month. Renews monthly, cancel anytime.
                  </p>
                </button>
              </div>
              <p className="font-sans text-cream/30 text-xs mb-5 text-center tracking-wide">
                Refundable with 48 hours notice · Food & drinks paid at the venue
              </p>
              <button
                onClick={() => handlePayment(selectedPlan)}
                disabled={submitting}
                className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-navy/60 border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    {selectedPlan === 'subscription' ? 'Subscribe $15/mo' : 'Pay $10 & Complete Booking'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Back navigation */}
      {!['yes_no', 'choice', 'payment', 'scale'].includes(current.type) && current.type !== 'multi_choice' && step > 0 && (
        <div className="relative z-10 px-6 pb-8 max-w-lg mx-auto w-full">
          <button
            onClick={prev}
            className="text-cream/30 hover:text-cream/70 text-sm font-sans transition-colors tracking-wide flex items-center gap-1.5"
          >
            ← Back
          </button>
        </div>
      )}

      {['yes_no', 'choice', 'scale'].includes(current.type) && step > 0 && (
        <div className="relative z-10 px-6 pb-8 max-w-lg mx-auto w-full">
          <button
            onClick={prev}
            className="text-cream/30 hover:text-cream/70 text-sm font-sans transition-colors tracking-wide flex items-center gap-1.5"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
