import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { QUESTIONS, CHAPTERS, isPhoneValid, ScaleSlider } from '../Quiz';
import { fileToDataUrl, cropAndResizeImage } from '../../utils/image';
import { clearCached } from '../../utils/cache';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { DIAL_CODES } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';
import PhotoCropModal from '../../components/PhotoCropModal';

const choiceIdle =
  'border-[#e7dcbd]/18 bg-[#e7dcbd]/[0.04] text-[#e7dcbd]/65 hover:border-[#e7dcbd]/40 hover:bg-[#e7dcbd]/[0.08] hover:text-[#e7dcbd]/95';
const choiceActive =
  'border-gold bg-gold text-navy shadow-[0_8px_32px_rgba(232,168,84,0.25)]';

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Badge + renewal date, with a Renew button that only shows up once there
// are 3 days or fewer left — otherwise it'd just be a button sitting there
// for weeks with nothing to actually do yet.
function SubscriptionCard({ renewsAt, onRenew, renewing }) {
  const msLeft = Math.max(0, new Date(renewsAt).getTime() - Date.now());
  const showRenew = msLeft <= THREE_DAYS_MS;

  return (
    <div className="quiz-card">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-widest uppercase text-gold bg-gold/10 border border-gold/20 rounded-full px-2.5 py-0.5">
          ✦ Subscription active
        </span>
      </div>
      <p className="font-sans text-cream/40 text-xs uppercase tracking-widest mb-1">Renews</p>
      <p className="font-serif text-2xl text-cream mb-3">
        {new Date(renewsAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
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
  const { attendeeUser, logout, resetPassword } = useAuth();
  const [locked, setLocked] = useState(null);
  const [answers, setAnswers] = useState({});
  const [initialAnswers, setInitialAnswers] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [subscription, setSubscription] = useState({ active: false, renewsAt: null });
  const [renewing, setRenewing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const subscriptionRef = useRef(null);
  const photoInputRef = useRef(null);
  const seededRef = useRef(false);

  const { data: profileData, loading, error: loadError, refetch } = useCachedFetch(
    'portal_full_profile',
    async () => (await api.get('/portal/full-profile')).data
  );

  useEffect(() => {
    if (loadError) toast.error('Failed to load your profile');
  }, [loadError]);

  useEffect(() => {
    if (!profileData) return;
    setLocked(profileData.locked);
    setSubscription({ active: !!profileData.hasActiveSubscription, renewsAt: profileData.subscriptionRenewsAt || null });
    // The editable form is only ever seeded once per mount — a background
    // revalidation (or the cached copy resolving after the cache already
    // rendered) must never clobber answers/autosave that are already in
    // progress. Nothing outside this page's own autosave ever changes these
    // fields anyway, so there's no real staleness risk in skipping the resync.
    if (!seededRef.current) {
      seededRef.current = true;
      const loaded = {
        ...(profileData.answers || {}),
        phone: profileData.locked?.phone || '',
        phoneCountryCode: profileData.locked?.phoneCountryCode || '+64',
        photo: profileData.photo || null,
      };
      setAnswers(loaded);
      setInitialAnswers(loaded);
    }
  }, [profileData]);

  const handleRenew = async () => {
    setRenewing(true);
    try {
      await api.post('/portal/subscription/renew');
      toast.success('Subscription renewed for another month!');
      refetch();
      // Dashboard's own cached copy of this (subscription badge, renewal
      // date) would otherwise still show the pre-renewal state until its
      // own background refetch happened to catch up.
      clearCached('portal_profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not renew right now.');
    } finally {
      setRenewing(false);
    }
  };

  const handleManageSubscription = () => {
    setShowAccountMenu(false);
    subscriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleResetPassword = async () => {
    setShowAccountMenu(false);
    try {
      await resetPassword(attendeeUser.email);
      toast.success(`Password reset link sent to ${attendeeUser.email}`);
    } catch (err) {
      toast.error('Could not send reset email. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete('/portal/account');
      clearCached('portal_profile');
      clearCached('portal_dinners');
      await logout();
      navigate('/');
      toast.success('Your account has been deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete your account. Please try again.');
      setDeleting(false);
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

  // Picking a file just opens the crop step — the actual resize/save
  // happens in handleCropConfirm once the user's chosen a crop.
  const handlePhotoSelect = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setCropSrc(dataUrl);
    } catch (err) {
      toast.error(err.message || 'Could not use that photo.');
    }
  };

  const handleCropConfirm = async (croppedAreaPixels) => {
    setPhotoUploading(true);
    try {
      const dataUrl = await cropAndResizeImage(cropSrc, croppedAreaPixels);
      setValue('photo', dataUrl);
    } catch (err) {
      toast.error(err.message || 'Could not use that photo.');
    } finally {
      setPhotoUploading(false);
      setCropSrc(null);
    }
  };

  // Returns whether it actually saved — callers that navigate away
  // afterward (like applyAndLeave below) need to know not to leave on a
  // failed save, or the still-unsaved changes just get discarded anyway.
  // `silent` skips the success toast for autosave — every pause-while-typing
  // firing a toast would get noisy fast; manual Save Changes clicks still
  // get one since that's an explicit action wanting confirmation.
  const save = async ({ silent = false } = {}) => {
    setSaveAttempted(true);
    if (phoneError) {
      if (!silent) toast.error(answers.phone ? 'Enter a valid phone number.' : 'Phone number is required.');
      return false;
    }
    setSaving(true);
    try {
      await api.patch('/portal/profile', answers);
      setInitialAnswers(answers);
      if (!silent) toast.success('Profile updated!');
      return true;
    } catch {
      toast.error('Failed to save changes');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Autosave: every change on this page saves itself shortly after the user
  // pauses, instead of requiring an explicit Save Changes click. Debounced
  // so a burst of quick changes (typing, tapping through choices) collapses
  // into one request rather than one per keystroke/tap.
  useEffect(() => {
    if (!isDirty || phoneError || saving) return;
    const t = setTimeout(() => { save({ silent: true }); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

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
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      <nav className="sticky top-0 z-20 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur bg-[#16181d]/90">
        <span className="font-sans text-cream/50 text-sm">← Back</span>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div>
          <p className="font-sans text-cream/40 text-sm">Your profile</p>
          <h1 className="font-serif text-3xl text-cream mt-1">Edit your answers</h1>
        </div>
        <div className="space-y-6 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="quiz-card space-y-3">
              <div className="h-4 w-32 rounded bg-white/[0.06]" />
              <div className="h-3 w-full rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (!profileData) return (
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
          {saving ? (
            <span className="font-sans text-cream/30 text-xs flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-cream/30 border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : isDirty ? (
            <span className="font-sans text-cream/25 text-xs">Unsaved</span>
          ) : initialAnswers && (
            <span className="font-sans text-cream/25 text-xs">Saved</span>
          )}
        </div>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-cream/40 text-sm">Your profile</p>
            <h1 className="font-serif text-3xl text-cream mt-1">Edit your answers</h1>
          </div>

          <div className="relative flex-shrink-0 mt-1">
            <button
              onClick={() => setShowAccountMenu(v => !v)}
              aria-label="Account settings"
              className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-cream/60 hover:text-gold hover:border-gold/40 transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {showAccountMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowAccountMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-navy border border-white/10 rounded-xl shadow-xl overflow-hidden z-30">
                  {subscription.active && (
                    <button
                      onClick={handleManageSubscription}
                      className="w-full text-left px-4 py-3 font-sans text-sm text-cream/80 hover:bg-white/[0.06] transition-colors"
                    >
                      Manage subscription
                    </button>
                  )}
                  <button
                    onClick={handleResetPassword}
                    className={`w-full text-left px-4 py-3 font-sans text-sm text-cream/80 hover:bg-white/[0.06] transition-colors ${subscription.active ? 'border-t border-white/[0.06]' : ''}`}
                  >
                    Reset password
                  </button>
                  <button
                    onClick={() => { setShowAccountMenu(false); setShowDeleteConfirm(true); }}
                    className="w-full text-left px-4 py-3 font-sans text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/[0.06]"
                  >
                    Delete account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {subscription.active && subscription.renewsAt && (
          <div ref={subscriptionRef}>
            <SubscriptionCard renewsAt={subscription.renewsAt} onRenew={handleRenew} renewing={renewing} />
          </div>
        )}

        {/* Profile photo — tapping an existing photo opens a big preview
            with the option to change it there, instead of jumping straight
            to the file picker every time. */}
        <div className="quiz-card flex items-center gap-5">
          <button
            type="button"
            onClick={() => { if (answers.photo) setShowPhotoModal(true); else photoInputRef.current?.click(); }}
            className="relative cursor-pointer group flex-shrink-0"
          >
            <input
              ref={photoInputRef}
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
          </button>
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

        {showPhotoModal && answers.photo && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowPhotoModal(false)}>
            <div className="max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <img src={answers.photo} alt="Your profile" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPhotoModal(false); photoInputRef.current?.click(); }}
                  className="quiz-cta flex-1"
                >
                  Change photo
                </button>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-cream/70 font-sans text-sm hover:bg-white/[0.04] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
                    <ScaleSlider q={q} value={answers[q.field]} onChange={(n) => setValue(q.field, n)} />
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="quiz-card w-full max-w-sm space-y-4">
            <p className="font-serif text-xl text-cream">Delete your account?</p>
            <p className="font-sans text-cream/60 text-sm leading-relaxed">
              This permanently deletes your profile, bookings, matches, messages, photos and cancels any active subscription.
              <span className="text-red-400"> This cannot be undone.</span>
            </p>
            <div>
              <label className="font-sans text-cream/50 text-xs block mb-1.5">Type DELETE to confirm</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-cream font-sans text-sm focus:outline-none focus:border-red-400/50"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-sans text-sm text-cream/70 border border-white/10 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 rounded-xl font-sans text-sm text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropSrc && (
        <PhotoCropModal imageSrc={cropSrc} cropShape="round" onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />
      )}

      <BottomNav />
    </div>
  );
}
