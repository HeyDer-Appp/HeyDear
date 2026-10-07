import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { openCheckout } from '../../utils/checkout';
import { useAuth } from '../../context/AuthContext';
import { QUESTIONS, CHAPTERS, isPhoneValid, ScaleSlider } from '../Quiz';
import { fileToDataUrl, cropAndResizeImage } from '../../utils/image';
import { clearCached } from '../../utils/cache';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { DIAL_CODES } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';
import { Stagger, Rise } from '../../components/Motion';
import PhotoCropModal from '../../components/PhotoCropModal';
import { isPushSupported, getPermissionState, subscribeToPush, unsubscribeFromPush } from '../../utils/push';
import { hapticsEnabled, setHapticsEnabled, tap as hapticTap } from '../../utils/haptics';

const choiceIdle =
  'border-transparent bg-navy/[0.05] text-navy/70 hover:bg-navy/[0.09] hover:text-navy';
const choiceActive =
  'border-plum bg-plum text-cream shadow-[0_6px_20px_rgba(117,68,113,0.25)]';

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Badge + days-until-renewal + dinners-attended stat, with a Renew button
// that only shows up once there are 3 days or fewer left — otherwise it'd
// just be a button sitting there for weeks with nothing to actually do yet.
function SubscriptionCard({ renewsAt, dinnersAttended, onRenew, renewing, onManageBilling, managingBilling }) {
  const msLeft = Math.max(0, new Date(renewsAt).getTime() - Date.now());
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const showRenew = msLeft <= THREE_DAYS_MS;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-widest uppercase text-plum bg-plum/10 border border-plum/20 rounded-full px-2.5 py-0.5">
          Active
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="font-sans text-navy/55 text-xs uppercase tracking-widest mb-1">Renews in</p>
          <p className="font-serif text-2xl text-navy leading-tight">{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</p>
          <p className="font-sans text-navy/45 text-xs mt-0.5">
            {new Date(renewsAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="font-sans text-navy/55 text-xs uppercase tracking-widest mb-1">Dinners</p>
          <p className="font-serif text-2xl text-navy leading-tight">{dinnersAttended}</p>
        </div>
      </div>
      {showRenew && (
        <p className="font-sans text-navy/55 text-xs mb-3">Renews automatically.</p>
      )}
      <button
        onClick={onManageBilling}
        disabled={managingBilling}
        className="w-full text-center py-2.5 rounded-xl border border-navy/15 text-navy/72 hover:text-navy hover:border-navy/30 font-sans text-sm transition-colors disabled:opacity-60"
      >
        {managingBilling ? '...' : 'Billing →'}
      </button>
    </div>
  );
}

// Shown instead of SubscriptionCard when there's no active subscription —
// otherwise "Manage subscription" led nowhere for anyone who didn't already
// have one, with no way to actually get one from here.
function NoSubscriptionCard({ dinnersAttended }) {
  return (
    <div className="glass-card">
      <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-widest uppercase text-navy/55 bg-white/40 border border-navy/15 rounded-full px-2.5 py-0.5 mb-4">
        No plan
      </span>
      <div className="mb-4">
        <p className="font-sans text-navy/55 text-xs uppercase tracking-widest mb-1">Dinners</p>
        <p className="font-serif text-2xl text-navy leading-tight">{dinnersAttended}</p>
      </div>
      <p className="font-sans text-navy/55 text-sm mb-4">Unlimited dinners, monthly.</p>
      <Link to="/portal/book" className="plum-cta w-full flex items-center justify-center">
        Subscribe →
      </Link>
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
        ? 'plum-cta text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-60'
        : 'plum-cta w-full flex items-center justify-center gap-2 disabled:opacity-60'}
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
  const [answers, setAnswers] = useState({});
  const [initialAnswers, setInitialAnswers] = useState(null);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [notifState, setNotifState] = useState(() => getPermissionState());
  const [notifBusy, setNotifBusy] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(() => hapticsEnabled());
  const photoInputRef = useRef(null);
  const seededRef = useRef(false);

  const { data: profileData, loading, error: loadError, refetch } = useCachedFetch(
    'portal_full_profile',
    async () => (await api.get('/portal/full-profile')).data
  );

  useEffect(() => {
    if (loadError) toast.error('Failed to load your profile');
  }, [loadError]);

  // Derived straight from profileData (not its own state) — a separate
  // setLocked() in the effect below was one render behind profileData
  // itself becoming non-null (state set in an effect always lags a tick),
  // so the very first render after a cached copy resolved could hit
  // locked.first_name etc. while locked was still null and crash.
  const locked = profileData?.locked ?? null;
  // Same reasoning as locked above — derived directly rather than mirrored
  // into state via the effect, so there's no lagging render where an
  // actually-subscribed user briefly sees the "no subscription" card.
  const subscription = {
    active: !!profileData?.hasActiveSubscription,
    renewsAt: profileData?.subscriptionRenewsAt || null,
  };
  const dinnersAttended = profileData?.dinnersAttended ?? 0;

  useEffect(() => {
    if (!profileData) return;
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

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const res = await api.post('/portal/subscription/manage');
      openCheckout(res.data.url);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not open billing right now.');
      setManagingBilling(false);
    }
  };

  const handleManageSubscription = () => {
    setShowAccountMenu(false);
    setShowSubscriptionModal(true);
  };

  const handleToggleNotifications = async () => {
    setNotifBusy(true);
    try {
      if (notifState === 'granted') {
        await unsubscribeFromPush(attendeeUser.uid);
        setNotifState('default');
        toast.success('Notifications turned off.');
      } else {
        const result = await subscribeToPush(attendeeUser.uid);
        if (result.success) {
          setNotifState('granted');
          toast.success('Notifications turned on.');
        } else if (result.error === 'denied') {
          setNotifState('denied');
          toast.error('Notifications are blocked — enable them in your device settings.');
        } else {
          toast.error('Could not turn on notifications. Please try again.');
        }
      }
    } finally {
      setNotifBusy(false);
    }
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

  const handleSignOut = async () => {
    await logout();
    navigate('/');
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

  // Leaving with unsaved changes saves them first, same as autosave would
  // do a moment later anyway — tapping Back right after a change used to
  // race the 900ms autosave debounce and pop an "Unsaved changes" dialog
  // almost every time, since a real edit is rarely followed by an idle
  // pause before the user moves on. Saving synchronously on the way out
  // gets the exact same result without ever interrupting them; the dialog
  // is now reserved for when that save itself fails (offline, server
  // error) — the one case where leaving really does risk losing something.
  const handleBackClick = (e) => {
    if (!isDirty) return;
    e.preventDefault();
    applyAndLeave();
  };
  const applyAndLeave = async () => {
    const saved = await save({ silent: true });
    if (saved) navigate('/portal');
    // A failed save (offline, server error — not a validation error, which
    // save() already toasts on its own) is the one time leaving needs a
    // real choice instead of just quietly succeeding.
    else if (!phoneError) setShowExitConfirm(true);
  };
  const leaveWithoutApplying = () => navigate('/portal');

  if (loading) return (
    <div className="portal-bg min-h-screen relative overflow-hidden pb-nav">
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 pb-5 backdrop-blur-md bg-beige/70"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <span className="font-sans text-navy/65 text-sm">← Back</span>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        <div className="w-10" />
      </nav>
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <h1 className="font-serif font-bold text-3xl text-navy">Profile</h1>
        <div className="space-y-6 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="glass-card space-y-3">
              <div className="h-4 w-32 rounded bg-white/40" />
              <div className="h-3 w-full rounded bg-white/40" />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );

  if (!profileData) return (
    <div className="portal-bg min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
        <Link to="/portal" className="plum-cta text-xs py-2 px-6">Back</Link>
      </div>
    </div>
  );

  return (
    <div className="portal-bg min-h-screen relative overflow-hidden pb-nav">
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 pb-5 backdrop-blur-md bg-beige/70"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-3">
          <Link to="/portal" onClick={handleBackClick} className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
          {saving ? (
            <span className="font-sans text-navy/45 text-xs flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-navy/30 border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : isDirty ? (
            <span className="font-sans text-navy/40 text-xs">Unsaved</span>
          ) : initialAnswers && (
            <span className="font-sans text-navy/40 text-xs">Saved</span>
          )}
        </div>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        <div className="w-10" />
      </nav>

      <Stagger className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">
        <Rise className="flex items-start justify-between gap-3">
          <h1 className="font-serif font-bold text-3xl text-navy">Profile</h1>

          <div className="relative flex-shrink-0 mt-1">
            <button
              onClick={() => setShowAccountMenu(v => !v)}
              aria-label="Account settings"
              className="w-9 h-9 rounded-full border border-navy/15 bg-white/40 flex items-center justify-center text-navy/72 hover:text-plum hover:border-plum/40 transition-colors"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {showAccountMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowAccountMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-cream border border-navy/15 rounded-xl shadow-xl overflow-hidden z-30">
                  <button
                    onClick={handleManageSubscription}
                    className="w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors"
                  >
                    Manage subscription
                  </button>
                  <button
                    onClick={handleResetPassword}
                    className="w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors border-t border-navy/10"
                  >
                    Reset password
                  </button>
                  <button
                    onClick={() => { const next = !hapticsOn; setHapticsEnabled(next); setHapticsOn(next); if (next) hapticTap(); }}
                    className="w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors border-t border-navy/10 flex items-center justify-between gap-2"
                  >
                    <span>Vibration</span>
                    <span className={`font-sans text-xs ${hapticsOn ? 'text-plum' : 'text-navy/45'}`}>{hapticsOn ? 'On' : 'Off'}</span>
                  </button>
                  {isPushSupported() && (
                    <button
                      onClick={handleToggleNotifications}
                      disabled={notifBusy}
                      className="w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors border-t border-navy/10 flex items-center justify-between gap-2 disabled:opacity-60"
                    >
                      <span>Notifications</span>
                      <span className={`font-sans text-xs ${notifState === 'granted' ? 'text-plum' : 'text-navy/45'}`}>
                        {notifBusy ? '...' : notifState === 'granted' ? 'On' : 'Off'}
                      </span>
                    </button>
                  )}
                  <a
                    href="https://www.instagram.com/heyder.nz"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowAccountMenu(false)}
                    className="block w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors border-t border-navy/10"
                  >
                    Follow Heyder
                  </a>
                  <button
                    onClick={() => { setShowAccountMenu(false); handleSignOut(); }}
                    className="w-full text-left px-4 py-3 font-sans text-base text-navy/85 hover:bg-white/60 transition-colors border-t border-navy/10"
                  >
                    Sign out
                  </button>
                  <button
                    onClick={() => { setShowAccountMenu(false); setShowDeleteConfirm(true); }}
                    className="w-full text-left px-4 py-3 font-sans text-base text-red-700 hover:bg-red-500/10 transition-colors border-t border-navy/10"
                  >
                    Delete account
                  </button>
                </div>
              </>
            )}
          </div>
        </Rise>

        {/* Profile photo — tapping an existing photo opens a big preview
            with the option to change it there, instead of jumping straight
            to the file picker every time. */}
        <Rise className="glass-card flex items-center gap-5">
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
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-plum/30 bg-plum/5 flex items-center justify-center overflow-hidden group-hover:border-plum/60 transition-colors">
              {photoUploading ? (
                <div className="w-5 h-5 border-2 border-plum border-t-transparent rounded-full animate-spin" />
              ) : answers.photo ? (
                <img src={answers.photo} alt="Your profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">📷</span>
              )}
            </div>
          </button>
          <div>
            <p className="font-sans font-semibold text-navy text-sm mb-1">Photo</p>
            {answers.photo && (
              <button
                onClick={() => setValue('photo', null)}
                className="font-sans text-navy/45 hover:text-red-700 text-xs transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </Rise>

        {showPhotoModal && answers.photo && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowPhotoModal(false)}>
            <div className="max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <img src={answers.photo} alt="Your profile" className="w-full aspect-square object-cover rounded-2xl border border-navy/15" />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPhotoModal(false); photoInputRef.current?.click(); }}
                  className="plum-cta flex-1"
                >
                  Change photo
                </button>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-navy/15 text-navy/80 font-sans text-sm hover:bg-white/60 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Locked identity fields */}
        <Rise className="glass-card">
          <p className="font-sans font-semibold text-navy/65 text-xs uppercase tracking-widest mb-3">
            Fixed
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-navy/45 text-xs">Name</p>
              <p className="text-navy/80">{locked.first_name} {locked.last_name}</p>
            </div>
            <div>
              <p className="text-navy/45 text-xs">Age</p>
              <p className="text-navy/80">{getAge(locked.dob)}</p>
            </div>
            <div>
              <p className="text-navy/45 text-xs">Email</p>
              <p className="text-navy/80 truncate">{locked.email}</p>
            </div>
          </div>
          <p className="font-sans text-navy/40 text-xs mt-3">
            Change: <a href="mailto:info@heyder.nz" className="text-plum/70 hover:text-plum">info@heyder.nz</a>
          </p>
        </Rise>

        {/* Contact number — editable here, unlike name/dob/email above */}
        <Rise className="glass-card">
          <p className="font-sans font-semibold text-navy text-sm mb-1">Contact number</p>
          <div className="flex gap-2">
            <select
              value={answers.phoneCountryCode || '+64'}
              onChange={e => setValue('phoneCountryCode', e.target.value)}
              className="portal-login-input w-24 flex-shrink-0 px-2"
            >
              {DIAL_CODES.map(([name, code]) => (
                <option key={name} value={code} className="bg-cream text-navy">{code}</option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={answers.phone || ''}
              onChange={e => setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              maxLength={10}
              className={`portal-login-input flex-1 ${phoneError && (answers.phone || saveAttempted) ? 'border-red-400/60' : ''}`}
            />
          </div>
          {phoneError && (answers.phone || saveAttempted) && (
            <p className="font-sans text-red-700/80 text-xs mt-1.5">
              {answers.phone ? 'Enter a valid phone number.' : 'Phone number is required.'}
            </p>
          )}
        </Rise>

        {/* Editable answers, grouped by chapter */}
        {CHAPTERS.map(chap => {
          const questions = EDITABLE_QUESTIONS.filter(q => q.chapter === chap.id);
          if (!questions.length) return null;
          return (
            <div key={chap.id} className="space-y-4">
              <Rise><p className="font-sans font-semibold text-navy/65 text-xs uppercase tracking-widest">
                {chap.title}
              </p></Rise>
              {questions.map(q => (
                <Rise key={q.id} className="glass-card">
                  <p className="font-serif text-lg text-navy mb-3">{q.title}</p>

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
                      className="w-full bg-white/40 border border-navy/15 rounded-xl px-4 py-3 text-navy placeholder-navy/40 font-sans text-sm focus:outline-none focus:border-plum/50 resize-none"
                    />
                  )}
                </Rise>
              ))}
            </div>
          );
        })}

        {isDirty && <Rise><SaveButton onClick={save} saving={saving} /></Rise>}

        <Rise className="pt-2 pb-4 text-center">
          <button onClick={handleSignOut} className="font-sans font-medium text-sm text-navy/65 hover:text-navy border border-navy/20 hover:border-navy/40 rounded-2xl px-8 py-3 transition-colors">Sign out</button>
        </Rise>
      </Stagger>

      {/* Only reachable now if leaving actually failed to save (see
          applyAndLeave) — a real choice, not a routine nag. */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-navy/80 backdrop-blur flex items-center justify-center p-6" onClick={() => setShowExitConfirm(false)}>
          <div className="glass-card max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <p className="font-serif font-bold text-xl text-navy mb-2">Couldn't save your changes</p>
            <p className="font-sans text-navy/65 text-sm mb-5">Check your connection and try again, or leave without saving.</p>
            <button
              onClick={() => { setShowExitConfirm(false); applyAndLeave(); }}
              disabled={saving}
              className="plum-cta w-full mb-3 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Try again'}
            </button>
            <button
              onClick={() => { setShowExitConfirm(false); leaveWithoutApplying(); }}
              disabled={saving}
              className="font-sans text-navy/55 hover:text-navy text-xs transition-colors disabled:opacity-50"
            >
              Leave without saving
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="glass-card w-full max-w-sm space-y-4">
            <p className="font-serif font-bold text-xl text-navy">Delete account?</p>
            <p className="font-sans text-navy/72 text-sm leading-relaxed">
              Everything is deleted, including any subscription. <span className="text-red-700">No undo.</span>
            </p>
            <div>
              <label className="font-sans text-navy/65 text-xs block mb-1.5">Type DELETE</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="w-full bg-white/40 border border-navy/15 rounded-xl px-4 py-2.5 text-navy font-sans text-sm focus:outline-none focus:border-red-400/50"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl font-sans text-sm text-navy/80 border border-navy/15 hover:bg-white/60 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 rounded-xl font-sans text-sm text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropSrc && (
        <PhotoCropModal imageSrc={cropSrc} cropShape="round" onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />
      )}

      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowSubscriptionModal(false)}>
          <div className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {subscription.active && subscription.renewsAt ? (
              <SubscriptionCard renewsAt={subscription.renewsAt} dinnersAttended={dinnersAttended} onRenew={handleRenew} renewing={renewing} onManageBilling={handleManageBilling} managingBilling={managingBilling} />
            ) : (
              <NoSubscriptionCard dinnersAttended={dinnersAttended} />
            )}
            <button
              onClick={() => setShowSubscriptionModal(false)}
              className="w-full mt-3 font-sans text-navy/55 hover:text-navy text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
