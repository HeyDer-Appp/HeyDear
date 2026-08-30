import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { QUESTIONS, CHAPTERS, isPhoneValid } from '../Quiz';
import { fileToResizedBase64 } from '../../utils/image';
import { DIAL_CODES } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';

const choiceIdle =
  'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95';
const choiceActive =
  'border-gold bg-gold text-navy shadow-[0_8px_32px_rgba(232,168,84,0.25)]';

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Badge + live countdown to renewal, with a Renew button that only shows up
// once there are 3 days or fewer left — otherwise it'd just be a button
// sitting there for weeks with nothing to actually do yet.
function SubscriptionCard({ renewsAt, onRenew, renewing }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const msLeft = Math.max(0, new Date(renewsAt).getTime() - now);
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((msLeft % (60 * 60 * 1000)) / 60000);
  const showRenew = msLeft <= THREE_DAYS_MS;

  return (
    <div className="quiz-card">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-widest uppercase text-gold bg-gold/10 border border-gold/20 rounded-full px-2.5 py-0.5">
          ✦ Subscription active
        </span>
      </div>
      <p className="font-sans text-cream/40 text-xs uppercase tracking-widest mb-1">Renews in</p>
      <p className="font-serif text-2xl text-cream mb-3">
        {days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`}
      </p>
      {showRenew && (
        <>
          <p className="font-sans text-cream/40 text-xs mb-3">Your membership is about to expire — renew now so your next dinner stays free.</p>
          <button onClick={onRenew} disabled={renewing} className="quiz-cta w-full disabled:opacity-60">
            {renewing ? 'Renewing...' : 'Renew for 1 more month'}
          </button>
        </>
      )}
    </div>
  );
}

// 'personal' (dob/gender/country) and 'contact' (phone) each have their own
// dedicated card above instead of going through this generic loop, which
// only knows how to render yes_no/choice/multi_choice/scale/text — leaving
// them in here rendered as an empty, input-less card with just the title.
const EDITABLE_QUESTIONS = QUESTIONS.filter(q => q.chapter && q.type !== 'personal' && q.type !== 'contact');

// Shared between the top-nav (compact) and bottom-of-form (full-width)
// save buttons — a change made scrolled down at the bottom otherwise has
// no visible save action without scrolling all the way back up to notice it.
function SaveButton({ onClick, saving, compact }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={compact
        ? 'quiz-cta text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-60'
        : 'quiz-cta w-full flex items-center justify-center gap-2 disabled:opacity-60'}
    >
      {saving ? (
        <>
          <div className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} border-2 border-navy/60 border-t-transparent rounded-full animate-spin`} />
          Saving...
        </>
      ) : 'Save Changes'}
    </button>
  );
}

export default function EditProfile() {
  const navigate = useNavigate();
  const [locked, setLocked] = useState(null);
  const [answers, setAnswers] = useState({});
  const [initialAnswers, setInitialAnswers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [subscription, setSubscription] = useState({ active: false, renewsAt: null });
  const [renewing, setRenewing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);

  const loadProfile = () => api.get('/portal/full-profile')
    .then(res => {
      setLocked(res.data.locked);
      const loaded = {
        ...(res.data.answers || {}),
        phone: res.data.locked?.phone || '',
        phoneCountryCode: res.data.locked?.phoneCountryCode || '+64',
        photo: res.data.photo || null,
      };
      setAnswers(loaded);
      setInitialAnswers(loaded);
      setSubscription({ active: !!res.data.hasActiveSubscription, renewsAt: res.data.subscriptionRenewsAt || null });
    })
    .catch(() => toast.error('Failed to load your profile'));

  useEffect(() => {
    loadProfile().finally(() => setLoading(false));
  }, []);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      await api.post('/portal/subscription/renew');
      toast.success('Subscription renewed for another month!');
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not renew right now.');
    } finally {
      setRenewing(false);
    }
  };

  // The save button only shows up once something's actually been touched —
  // compares against a snapshot taken right after load (and refreshed after
  // every successful save), not a dirty flag that could drift out of sync.
  const isDirty = initialAnswers !== null && JSON.stringify(answers) !== JSON.stringify(initialAnswers);
  // isPhoneValid() alone treats an empty phone as "valid" (it's skippable
  // during the initial signup quiz) — but this edit page has no skip
  // option, so an empty phone here should block saving, not pass through.
  const phoneError = !isPhoneValid(answers.phone) || !answers.phone;

  const setValue = (field, value) => setAnswers(prev => ({ ...prev, [field]: value }));

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

  // Returns whether it actually saved — callers that navigate away
  // afterward (like applyAndLeave below) need to know not to leave on a
  // failed save, or the still-unsaved changes just get discarded anyway.
  const save = async () => {
    setSaveAttempted(true);
    if (phoneError) {
      toast.error(answers.phone ? 'Enter a valid phone number.' : 'Phone number is required.');
      return false;
    }
    setSaving(true);
    try {
      await api.patch('/portal/profile', answers);
      setInitialAnswers(answers);
      toast.success('Profile updated!');
      return true;
    } catch {
      toast.error('Failed to save changes');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Leaving with unsaved changes asks first instead of silently discarding
  // them — "Apply" saves then leaves, "Do not apply" leaves without saving.
  const handleBackClick = (e) => {
    if (isDirty) {
      e.preventDefault();
      setShowExitConfirm(true);
    }
  };
  const applyAndLeave = async () => {
    const saved = await save();
    if (saved) navigate('/portal');
  };
  const leaveWithoutApplying = () => navigate('/portal');

  if (loading) return (
    <div className="quiz-bg min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!locked) return (
    <div className="quiz-bg min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="font-serif text-2xl text-cream mb-3">Couldn't load your profile</p>
        <Link to="/portal" className="quiz-cta text-xs py-2 px-6">Back to dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur bg-[#16181d]/90">
        <div className="flex items-center gap-3">
          <Link to="/portal" onClick={handleBackClick} className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
          {isDirty && <SaveButton onClick={save} saving={saving} compact />}
        </div>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div>
          <p className="font-sans text-cream/40 text-sm">Your profile</p>
          <h1 className="font-serif text-3xl text-cream mt-1">Edit your answers</h1>
          <p className="font-sans text-cream/40 text-sm mt-2 leading-relaxed">
            Change anything you like — we'll use your latest answers for future matching.
          </p>
        </div>

        {subscription.active && subscription.renewsAt && (
          <SubscriptionCard renewsAt={subscription.renewsAt} onRenew={handleRenew} renewing={renewing} />
        )}

        {/* Profile photo */}
        <div className="quiz-card flex items-center gap-5">
          <label className="relative cursor-pointer group flex-shrink-0">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handlePhotoSelect(e.target.files?.[0])}
            />
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
            <p className="font-sans font-semibold text-cream text-sm mb-1">Profile photo</p>
            <p className="font-sans text-cream/40 text-xs mb-2">Helps your table recognise you.</p>
            {answers.photo && (
              <button
                onClick={() => setValue('photo', null)}
                className="font-sans text-cream/30 hover:text-red-400 text-xs transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Locked identity fields */}
        <div className="quiz-card">
          <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest mb-3">
            Can't be changed here
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-cream/30 text-xs">Name</p>
              <p className="text-cream/70">{locked.first_name} {locked.last_name}</p>
            </div>
            <div>
              <p className="text-cream/30 text-xs">Age</p>
              <p className="text-cream/70">{getAge(locked.dob)}</p>
            </div>
            <div>
              <p className="text-cream/30 text-xs">Email</p>
              <p className="text-cream/70 truncate">{locked.email}</p>
            </div>
          </div>
          <p className="font-sans text-cream/25 text-xs mt-3">
            Need to fix one of these? Email <a href="mailto:info@heyder.nz" className="text-gold/70 hover:text-gold">info@heyder.nz</a>
          </p>
        </div>

        {/* Contact number — editable here, unlike name/dob/email above */}
        <div className="quiz-card">
          <p className="font-sans font-semibold text-cream text-sm mb-1">Contact number</p>
          <div className="flex gap-2">
            <select
              value={answers.phoneCountryCode || '+64'}
              onChange={e => setValue('phoneCountryCode', e.target.value)}
              className="quiz-input w-24 flex-shrink-0 px-2"
            >
              {DIAL_CODES.map(([name, code]) => (
                <option key={name} value={code} className="bg-navy text-cream">{code}</option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={answers.phone || ''}
              onChange={e => setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              className={`quiz-input flex-1 ${phoneError && (answers.phone || saveAttempted) ? 'border-red-400/60' : ''}`}
            />
          </div>
          {phoneError && (answers.phone || saveAttempted) && (
            <p className="font-sans text-red-400/80 text-xs mt-1.5">
              {answers.phone ? 'Enter a valid phone number.' : 'Phone number is required.'}
            </p>
          )}
        </div>

        {/* Editable answers, grouped by chapter */}
        {CHAPTERS.map(chap => {
          const questions = EDITABLE_QUESTIONS.filter(q => q.chapter === chap.id);
          if (!questions.length) return null;
          return (
            <div key={chap.id} className="space-y-4">
              <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">
                {chap.title}
              </p>
              {questions.map(q => (
                <div key={q.id} className="quiz-card">
                  <p className="font-serif text-lg text-cream mb-3">{q.title}</p>

                  {q.type === 'yes_no' && (
                    <div className="flex gap-3">
                      {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setValue(q.field, opt.value)}
                          className={`flex-1 py-3 rounded-xl border font-sans text-sm transition-all ${
                            answers[q.field] === opt.value ? choiceActive : choiceIdle
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'choice' && (
                    <div className="flex flex-wrap gap-2">
                      {q.choices.map(choice => (
                        <button
                          key={choice}
                          onClick={() => setValue(q.field, choice)}
                          className={`px-4 py-2 rounded-full border font-sans text-sm transition-all ${
                            answers[q.field] === choice ? choiceActive : choiceIdle
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'multi_choice' && (
                    <div className="flex flex-wrap gap-2">
                      {q.choices.map(choice => {
                        const cur = answers[q.field] || [];
                        const selected = cur.includes(choice);
                        return (
                          <button
                            key={choice}
                            onClick={() => {
                              if (choice === 'Not Applicable') {
                                setValue(q.field, ['Not Applicable']);
                              } else {
                                const filtered = cur.filter(c => c !== 'Not Applicable');
                                setValue(q.field, selected ? filtered.filter(c => c !== choice) : [...filtered, choice]);
                              }
                            }}
                            className={`px-4 py-2 rounded-full border font-sans text-sm transition-all ${
                              selected ? choiceActive : choiceIdle
                            }`}
                          >
                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'scale' && (
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-sans text-cream/35 text-xs">{q.labels?.[0]}</span>
                        <span className="font-sans text-cream/35 text-xs">{q.labels?.[1]}</span>
                      </div>
                      <div className="flex gap-1.5 justify-between">
                        {Array.from({ length: q.max - q.min + 1 }, (_, i) => i + q.min).map(n => (
                          <button
                            key={n}
                            onClick={() => setValue(q.field, n)}
                            className={`flex-1 aspect-square max-w-[36px] rounded-full font-sans text-xs font-medium transition-all ${
                              answers[q.field] === n
                                ? 'bg-gold text-navy scale-110'
                                : 'border border-[#e7dcbd]/15 bg-[#e7dcbd]/[0.03] text-[#e7dcbd]/40 hover:border-[#e7dcbd]/40 hover:text-[#e7dcbd]/90'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.type === 'text' && (
                    <textarea
                      value={answers[q.field] || ''}
                      onChange={e => setValue(q.field, e.target.value)}
                      rows={3}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream placeholder-cream/25 font-sans text-sm focus:outline-none focus:border-gold/50 resize-none"
                    />
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {isDirty && <SaveButton onClick={save} saving={saving} />}
      </div>

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-navy/80 backdrop-blur flex items-center justify-center p-6" onClick={() => setShowExitConfirm(false)}>
          <div className="quiz-card max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <p className="font-serif text-xl text-cream mb-2">Unsaved changes</p>
            <p className="font-sans text-cream/50 text-sm mb-6">
              Do you want to proceed without applying these changes?
            </p>
            <button
              onClick={() => { setShowExitConfirm(false); applyAndLeave(); }}
              disabled={saving}
              className="quiz-cta w-full mb-3 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Apply'}
            </button>
            <button
              onClick={() => { setShowExitConfirm(false); leaveWithoutApplying(); }}
              disabled={saving}
              className="font-sans text-cream/40 hover:text-cream text-xs transition-colors disabled:opacity-50"
            >
              Do not apply
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
