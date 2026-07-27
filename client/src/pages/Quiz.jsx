import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { fileToResizedBase64 } from '../utils/image';

// A question's title fades up on entry; its options then fade in from the
// left, one after another, orchestrated by the stagger container below.
// Deliberately slow — this is meant to feel like an unfolding moment, not
// a UI blip.
const easeOutExpo = [0.22, 1, 0.36, 1];
const fadeUpVariant = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
};
const staggerContainerVariant = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.4 } },
};
const fadeLeftVariant = {
  hidden: { opacity: 0, x: -28 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easeOutExpo } },
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
  {
    id: 'photo',
    type: 'photo',
    title: 'Add a profile photo',
    description: "Optional, but it helps your table recognise you",
    required: false,
  },

  // Chapter 1 — The Basics
  {
    id: 'personal',
    type: 'personal',
    title: 'Just a few more details',
    chapter: 'basics',
    required: true,
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
    id: 'contact',
    type: 'contact',
    title: "What's the best number to reach you on?",
    chapter: 'basics',
    required: false,
  },

  // Chapter 2 — How You Show Up
  {
    id: 'personality',
    type: 'choice',
    title: 'Would you say you\'re more…',
    field: 'field_L6GblNns9C7v',
    chapter: 'show_up',
    required: true,
    choices: ['Outgoing', 'Reserved', 'Bit of both'],
  },
  {
    id: 'battery',
    type: 'choice',
    title: "How's your social battery these days?",
    field: 'field_LosYJHqrbpKO',
    chapter: 'show_up',
    required: true,
    choices: ['Never runs out', 'Need occasional charging', 'Drains pretty fast'],
  },
  {
    id: 'career_pref',
    type: 'choice',
    title: 'If paid equally, which career would you choose?',
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
    title: 'Most weekends, you are…',
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
    title: 'In a group, you naturally become the one who…',
    field: 'group_role',
    chapter: 'drawn_to',
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
    chapter: 'drawn_to',
    required: true,
    choices: ['Address it head on', 'Smooth it over with humour', 'Wait it out', 'Play mediator'],
  },
  {
    id: 'connection_trigger',
    type: 'choice',
    title: 'You feel instantly connected to someone who…',
    field: 'connection_trigger',
    chapter: 'drawn_to',
    required: true,
    choices: ['Makes you laugh', 'Asks real questions', 'Shares a niche interest', 'Is unapologetically themselves'],
  },
  {
    id: 'social_recharge',
    type: 'scale',
    title: 'The day after a big night out, you feel',
    field: 'social_recharge',
    chapter: 'drawn_to',
    required: true,
    min: 0, max: 10,
    labels: ['Wiped out', 'Recharged'],
  },
  {
    id: 'conversation_avoid',
    type: 'choice',
    title: 'The conversation you try to avoid most',
    field: 'conversation_avoid',
    chapter: 'drawn_to',
    required: true,
    choices: ['Small talk', 'Oversharing too soon', 'Debating opinions', 'Talking about work'],
  },
  {
    id: 'first_meeting_style',
    type: 'choice',
    title: 'Meeting someone new, you usually…',
    field: 'first_meeting_style',
    chapter: 'drawn_to',
    required: true,
    choices: ['Ask lots of questions', 'Wait for them to open up', 'Crack a joke to break the ice', 'Just vibe and see what happens'],
  },

  // Chapter 4 — How You Move Through A Conversation
  {
    id: 'deep_convo',
    type: 'scale',
    title: 'I enjoy having deep conversations in a group',
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
    title: 'You straight up ask questions when curious',
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
    title: 'Financial security comes first',
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
    description: 'All restaurants are rated 4.3+ and cater to allergen requirements',
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
    choices: ['Not Applicable', 'Gluten free', 'Dairy free', 'Nut free', 'Vegan', 'Vegetarian'],
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

const choiceBase =
  'text-left px-4 py-2.5 rounded-xl border font-sans text-sm transition-all duration-150 cursor-pointer';
const choiceIdle =
  'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95';
const choiceActive =
  'border-gold bg-gold text-navy font-medium shadow-[0_4px_16px_rgba(232,168,84,0.2)]';

const PHOTO_Q = QUESTIONS.find(q => q.id === 'photo');
const DATE_Q = QUESTIONS.find(q => q.id === 'date');
const CHAPTER_QUESTIONS = CHAPTERS.map(chap => ({
  chapter: chap,
  questions: QUESTIONS.filter(q => q.chapter === chap.id),
}));

// Splits a chapter's questions into pages of 2-3 so no single page feels
// crowded — as even a split as possible, never more than 3 per page.
function chunkInto2or3(items) {
  if (items.length <= 3) return [items];
  const numGroups = Math.ceil(items.length / 3);
  const base = Math.floor(items.length / numGroups);
  let remainder = items.length % numGroups;
  const groups = [];
  let idx = 0;
  for (let g = 0; g < numGroups; g++) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    groups.push(items.slice(idx, idx + size));
    idx += size;
  }
  return groups;
}

// Every "box" is its own page in the profile flow — photo first, then each
// chapter split into short 2-3 question pages (untitled, no chapter name
// shown), then the date pick and payment as the final two pages.
const STEPS = [
  { type: 'photo' },
  ...CHAPTER_QUESTIONS.flatMap(({ chapter, questions }) =>
    chunkInto2or3(questions).map(qs => ({ type: 'chapter', chapterId: chapter.id, questions: qs }))
  ),
  { type: 'date' },
  { type: 'payment' },
];

// Every field that has to be filled in before the profile counts as "done" —
// drives both the completion % and the final submit validation.
const REQUIRED_FIELD_QUESTIONS = QUESTIONS.filter(q => q.required && q.field);

function isAnswered(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== '' && value !== null;
}

// One question's answer widget — reused across every chapter section.
// Title fades up on mount; its options then fade in from the left, one by
// one, every time this question is freshly mounted (i.e. a new page opens).
function QuestionField({ q, value, onChange, error }) {
  return (
    <motion.div
      id={`q-${q.id}`}
      className={`py-4 ${error ? 'rounded-xl -mx-3 px-3 bg-red-500/5' : ''}`}
      initial="hidden"
      animate="visible"
    >
      <motion.p variants={fadeUpVariant} className="font-sans text-cream text-[15px] mb-3 leading-snug">
        {q.title}{q.required && <span className="text-gold/60"> *</span>}
      </motion.p>

      {q.type === 'yes_no' && (
        <motion.div variants={staggerContainerVariant} className="flex gap-2.5">
          {[{ label: 'Yes', v: true }, { label: 'No', v: false }].map(opt => (
            <motion.button
              key={opt.label}
              variants={fadeLeftVariant}
              type="button"
              onClick={() => onChange(opt.v)}
              className={`flex-1 py-2.5 rounded-xl border font-sans text-sm transition-all ${value === opt.v ? choiceActive : choiceIdle}`}
            >
              {opt.label}
            </motion.button>
          ))}
        </motion.div>
      )}

      {q.type === 'choice' && (
        <motion.div variants={staggerContainerVariant} className="flex flex-wrap gap-2">
          {q.choices.map(choice => (
            <motion.button
              key={choice}
              variants={fadeLeftVariant}
              type="button"
              onClick={() => onChange(choice)}
              className={`${choiceBase} ${value === choice ? choiceActive : choiceIdle}`}
            >
              {choice}
            </motion.button>
          ))}
        </motion.div>
      )}

      {q.type === 'multi_choice' && (
        <motion.div variants={staggerContainerVariant} className="flex flex-wrap gap-2">
          {q.choices.map(choice => {
            const cur = value || [];
            const selected = cur.includes(choice);
            return (
              <motion.button
                key={choice}
                variants={fadeLeftVariant}
                type="button"
                onClick={() => {
                  if (choice === 'Not Applicable') { onChange(['Not Applicable']); return; }
                  const filtered = cur.filter(c => c !== 'Not Applicable');
                  onChange(selected ? filtered.filter(c => c !== choice) : [...filtered, choice]);
                }}
                className={`${choiceBase} ${selected ? choiceActive : choiceIdle}`}
              >
                {choice}
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {q.type === 'scale' && (
        <div>
          <div className="flex justify-between mb-2">
            <span className="font-sans text-cream/35 text-xs">{q.labels?.[0]}</span>
            <span className="font-sans text-cream/35 text-xs">{q.labels?.[1]}</span>
          </div>
          <motion.div variants={staggerContainerVariant} className="flex gap-1.5 justify-between">
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => i + q.min).map(n => (
              <motion.button
                key={n}
                variants={fadeLeftVariant}
                type="button"
                onClick={() => onChange(n)}
                className={`flex-1 aspect-square max-w-[38px] rounded-full font-sans text-xs font-medium transition-all ${
                  value === n
                    ? 'bg-gold text-navy scale-110'
                    : 'border border-[#e7dcbd]/15 bg-[#e7dcbd]/[0.03] text-[#e7dcbd]/40 hover:border-[#e7dcbd]/40 hover:text-[#e7dcbd]/90'
                }`}
              >
                {n}
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}

      {q.type === 'text' && (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={q.placeholder}
          rows={2}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream placeholder-cream/25 font-sans text-sm focus:outline-none focus:border-gold/50 resize-none"
        />
      )}
    </motion.div>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const { attendeeUser } = useAuth();
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [disqualified, setDisqualified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [dateChoices, setDateChoices] = useState(DATE_Q.choices);
  const [savedAt, setSavedAt] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const hasLoadedRef = useRef(false);
  const autosaveTimer = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stepIndex]);

  useEffect(() => {
    api.get('/portal/full-profile')
      .then(res => {
        const { locked, hasActiveSubscription: hasSub, photo, answers: savedAnswers } = res.data;
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
      })
      .catch(() => {})
      .finally(() => {
        setLoadingProfile(false);
        // Only start autosaving once the initial prefill has landed, so
        // loading someone's existing answers doesn't immediately "save" them
        // straight back (harmless, but a wasted round-trip on every visit).
        hasLoadedRef.current = true;
      });

    api.get('/profile/questions')
      .then(res => {
        const dateQuestion = res.data.questions?.find(q => q.id === 'CdZldwp5q09o');
        if (dateQuestion?.choices?.length) setDateChoices(dateQuestion.choices);
      })
      .catch(() => {});
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
  const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  // Maps a question id back to the page it lives on, so a failed final
  // validation can jump to the right page before scrolling to the field —
  // only the current page's fields are ever in the DOM.
  const stepIndexForQuestionId = (qid) => {
    if (qid === 'date') return STEPS.findIndex(s => s.type === 'date');
    return STEPS.findIndex(s => s.type === 'chapter' && s.questions.some(q => q.id === qid));
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
    const qs = CHAPTER_QUESTIONS.find(c => c.chapter.id === chapterId).questions.filter(q => q.required);
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

  const validate = () => {
    const newErrors = {};
    const missingIds = [];

    for (const q of REQUIRED_FIELD_QUESTIONS) {
      if (!isAnswered(answers[q.field])) { newErrors[q.field] = true; missingIds.push(q.id); }
    }
    if (!answers.dob) { newErrors.dob = true; missingIds.push('personal'); }
    if (!answers.gender) { newErrors.gender = true; missingIds.push('personal'); }
    if (!answers.country) { newErrors.country = true; missingIds.push('personal'); }
    if (!isAnswered(answers.field_CdZldwp5q09o)) { newErrors.field_CdZldwp5q09o = true; missingIds.push('date'); }

    setErrors(newErrors);
    if (missingIds.length) {
      toast.error('Please fill in the highlighted fields.');
      scrollToFirstError(missingIds);
      return false;
    }
    return true;
  };

  const handlePayment = async (plan) => {
    if (!validate()) return;
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
    if (!validate()) return;
    setSubmitting(true);
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

  if (loadingProfile) {
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
    <div className="quiz-bg min-h-screen relative overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
        <a href="/"><img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-8" /></a>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span key={savedAt} className="font-sans text-cream/25 text-[11px] tracking-wide animate-[fadeOut_2.5s_ease-in-out_forwards]">
              ✓ Saved
            </span>
          )}
          <span className="font-sans text-cream/40 text-xs tracking-widest uppercase">{completionPct}% complete</span>
        </div>
      </div>
      <div className="relative z-10 h-[2px] bg-white/[0.05]">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${completionPct}%`, background: 'linear-gradient(90deg, #E8A854 0%, #f0c040 100%)' }}
        />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-6 py-10 space-y-8">
        {/* Chapter marker — chapter 1 gets its own line, others get a generic "Chapter N" */}
        {step.type === 'chapter' && (
          <div className="text-center">
            <motion.h1
              key={stepIndex}
              initial="hidden"
              animate="visible"
              variants={fadeUpVariant}
              className="font-serif text-3xl md:text-4xl text-cream"
            >
              {step.chapterId === 'basics'
                ? "Let's get to know a little bit about you"
                : `Chapter ${CHAPTERS.findIndex(c => c.id === step.chapterId) + 1}`}
            </motion.h1>
          </div>
        )}

        {profileChips.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {profileChips.map((c, i) => (
              <span key={i} className="text-xs px-3 py-1 rounded-full border border-gold/20 bg-gold/5 text-cream/60 flex items-center gap-1.5">
                <span>{c.icon}</span>{c.label}
              </span>
            ))}
          </div>
        )}

        {/* One page per step — photo, then each chapter's questions (untitled), then date, then payment */}
        {step.type === 'photo' && (
          <div className="quiz-card flex items-center gap-5">
            <label className="relative cursor-pointer group flex-shrink-0">
              <input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoSelect(e.target.files?.[0])} />
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gold/30 bg-gold/5 flex items-center justify-center overflow-hidden group-hover:border-gold/60 transition-colors">
                {photoUploading ? (
                  <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                ) : answers.photo ? (
                  <img src={answers.photo} alt="Your profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </div>
            </label>
            <div>
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-sans font-semibold text-cream text-sm mb-1">{PHOTO_Q.title}</motion.p>
              <p className="font-sans text-cream/40 text-xs mb-2">{PHOTO_Q.description}</p>
              {answers.photo && (
                <button onClick={() => setValue('photo', null)} className="font-sans text-cream/30 hover:text-red-400 text-xs transition-colors">
                  Remove photo
                </button>
              )}
            </div>
          </div>
        )}

        {step.type === 'chapter' && (() => {
          const questions = step.questions;
          return (
            <div className="quiz-card">
              <div className="divide-y divide-white/[0.05]">
                {questions.map(q => {
                  if (q.type === 'contact') {
                    return (
                      <div key="contact" id="q-contact" className="py-4">
                        <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-sans text-cream text-[15px] mb-3">{q.title}</motion.p>
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={answers.phone || ''}
                          onChange={e => setValue('phone', e.target.value)}
                          className="quiz-input"
                        />
                      </div>
                    );
                  }
                  if (q.type === 'personal') {
                    return (
                      <div key="personal" id="q-personal" className={`py-4 ${(errors.dob || errors.gender || errors.country) ? 'rounded-xl -mx-3 px-3 bg-red-500/5' : ''}`}>
                        <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-sans text-cream text-[15px] mb-3">{q.title}<span className="text-gold/60"> *</span></motion.p>
                        <div className="space-y-3">
                          <div>
                            <label className="font-sans text-cream/40 text-xs tracking-[0.1em] uppercase mb-1.5 block">Date of birth</label>
                            <input type="date" value={answers.dob || ''} onChange={e => setValue('dob', e.target.value)} className="quiz-input" />
                          </div>
                          <div>
                            <label className="font-sans text-cream/40 text-xs tracking-[0.1em] uppercase mb-1.5 block">Gender</label>
                            <select value={answers.gender || ''} onChange={e => setValue('gender', e.target.value)} className="quiz-input">
                              <option value="">Select gender</option>
                              {['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="font-sans text-cream/40 text-xs tracking-[0.1em] uppercase mb-1.5 block">Country of origin</label>
                            <select value={answers.country || ''} onChange={e => setValue('country', e.target.value)} className="quiz-input">
                              <option value="">Select country</option>
                              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <QuestionField
                      key={q.id}
                      q={q}
                      value={answers[q.field]}
                      onChange={(v) => handleFieldAnswer(q, v)}
                      error={errors[q.field]}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}

        {step.type === 'date' && (
          <>
            {profileReady && (
              <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.1] to-white/[0.02] p-5 text-center">
                <p className="font-serif text-lg text-cream">🎉 Your profile is ready</p>
                <p className="font-sans text-cream/50 text-xs mt-1">Just pick a Tuesday and you're booked in.</p>
              </div>
            )}

            <div id="q-date" className={`quiz-card ${errors.field_CdZldwp5q09o ? 'bg-red-500/5 border-red-400/30' : ''}`}>
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif text-xl text-cream mb-1">{DATE_Q.title}</motion.p>
              <p className="font-sans text-cream/35 text-xs mb-3">Your reservation covers one Tuesday dinner.</p>
              <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="flex flex-wrap gap-2">
                {dateChoices.map(choice => (
                  <motion.button
                    key={choice}
                    variants={fadeLeftVariant}
                    type="button"
                    onClick={() => setValue('field_CdZldwp5q09o', choice)}
                    className={`${choiceBase} ${answers.field_CdZldwp5q09o === choice ? choiceActive : choiceIdle}`}
                  >
                    {choice}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          </>
        )}

        {step.type === 'payment' && (
          <div className="quiz-card">
            <div className="flex items-center gap-2 mb-1">
              <motion.p initial="hidden" animate="visible" variants={fadeUpVariant} className="font-serif text-xl text-cream">Reserve your spot</motion.p>
              {!stripeConfigured && (
                <span className="text-[10px] font-sans font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-yellow/15 text-yellow">
                  Test mode
                </span>
              )}
            </div>
            <p className="font-sans text-cream/35 text-xs mb-4">
              {stripeConfigured
                ? "Choose how you'd like to join — refundable with 48hrs notice."
                : 'Payments are not connected yet — booking will be simulated, no card required.'}
            </p>

            {hasActiveSubscription ? (
              <div>
                <div className="rounded-xl border border-gold/25 bg-gold/[0.06] p-4 mb-4 text-center">
                  <p className="font-sans text-cream/70 text-sm">✓ You're covered by your monthly membership — no extra charge.</p>
                </div>
                <button
                  onClick={() => submitQuizWithoutPayment()}
                  disabled={submitting}
                  className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            ) : (
              <div>
                <motion.div initial="hidden" animate="visible" variants={staggerContainerVariant} className="space-y-3 mb-5">
                  <motion.button
                    variants={fadeLeftVariant}
                    type="button"
                    onClick={() => setSelectedPlan('one_time')}
                    className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${selectedPlan === 'one_time' ? choiceActive : choiceIdle}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans font-semibold text-base">One-time reservation</span>
                      <span className="font-serif text-2xl">$10</span>
                    </div>
                    <p className={`font-sans text-sm ${selectedPlan === 'one_time' ? 'text-navy/60' : 'text-cream/40'}`}>Reserve just this Tuesday's dinner.</p>
                  </motion.button>
                  <motion.button
                    variants={fadeLeftVariant}
                    type="button"
                    onClick={() => setSelectedPlan('subscription')}
                    className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 relative ${selectedPlan === 'subscription' ? choiceActive : choiceIdle}`}
                  >
                    <span className="absolute -top-2.5 right-5 bg-yellow text-navy text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Best value</span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-sans font-semibold text-base">Monthly membership</span>
                      <span className="font-serif text-2xl">$15<span className="text-sm">/mo</span></span>
                    </div>
                    <p className={`font-sans text-sm ${selectedPlan === 'subscription' ? 'text-navy/60' : 'text-cream/40'}`}>Unlimited HeyDer dinners this month. Cancel anytime.</p>
                  </motion.button>
                </motion.div>
                <button
                  onClick={() => handlePayment(selectedPlan)}
                  disabled={submitting}
                  className="quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting
                    ? 'Processing...'
                    : !stripeConfigured
                      ? 'Complete Booking (Test Mode)'
                      : selectedPlan === 'subscription' ? 'Subscribe $15/mo' : 'Pay $10 & Complete Booking'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {stepIndex > 0 ? (
            <button onClick={goBack} className="font-sans text-cream/50 hover:text-cream text-sm px-2 py-3 transition-colors">
              ← Back
            </button>
          ) : <span />}
          {step.type !== 'payment' && (
            <button onClick={goNext} className="quiz-cta px-8 py-3">
              {step.type === 'date' ? 'Continue to payment →' : 'Next →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
