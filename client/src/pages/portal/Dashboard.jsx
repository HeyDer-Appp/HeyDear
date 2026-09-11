import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BottomNav from '../../components/BottomNav';
import OnboardingTour from '../../components/OnboardingTour';
import { flagUrl } from '../../utils/flags';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { prefetchPortalData } from '../../utils/prefetch';

const AVATAR = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

const PRE_PROFILE_CITIES = ['Auckland', 'Wellington', 'Sydney', 'Melbourne', 'Brisbane'];

// Frosted-glass dropdown for the pre-profile city picker — a native <select>
// can't get this look (backdrop-filter on its open option list isn't
// stylable cross-browser), so this is a plain button + panel instead.
function CityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 font-sans text-base text-navy transition-all"
        style={{
          background: 'rgba(255,255,255,0.35)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)',
          border: '1px solid rgba(22,24,29,0.12)',
          boxShadow: '0 6px 18px rgba(22,24,29,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        <span className={value ? 'text-navy' : 'text-navy/40'}>{value || 'Select your city'}</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className="text-navy/50 transition-transform duration-200 flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
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
          {PRE_PROFILE_CITIES.map(city => (
            <button
              key={city}
              type="button"
              onClick={() => { onChange(city); setOpen(false); }}
              className="w-full text-left px-5 py-3 font-sans text-sm text-navy hover:bg-navy/5 transition-colors"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_CONFIG = {
  pending: {
    label: 'Finding your group',
    color: 'text-yellow',
    bg: 'bg-yellow/10',
    border: 'border-yellow/20',
    icon: '⏳',
    description: '',
  },
  matched: {
    label: 'Your group is locked in',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    icon: '✦',
    description: "Your table has been curated. A glimpse of who you're meeting drops 48 hours before dinner.",
  },
  glimpse: {
    label: 'Meet your table',
    color: 'text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: '👀',
    description: "Here's a sneak peek at your dinner companions. Restaurant revealed in 24 hours.",
  },
  venue: {
    label: 'Venue',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    icon: '✓',
    description: "Everything is locked in. See you tonight at 7pm.",
  },
};

// A tablemate's career answer, with their name and photo both masked until
// the 8pm reveal — only the job-for-a-kid answer is visible from the start.
// Once revealed, the whole card links through to their profile — the
// "click their name to view albums/connect" entry point from there on.
function GlimpseCard({ member, revealed }) {
  const Wrapper = revealed ? Link : 'div';
  const wrapperProps = revealed ? { to: `/portal/person/${member.user_id}` } : {};
  return (
    <Wrapper {...wrapperProps} className={`flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5 ${revealed ? 'hover:border-gold/30 hover:scale-[1.02] transition-all duration-300' : ''}`}>
      {member.photo ? (
        <div className="rounded-full overflow-hidden w-12 h-12 flex-shrink-0 border border-white/10">
          <img
            src={member.photo}
            alt=""
            className="w-full h-full object-cover transition-[filter] duration-700"
            style={revealed ? undefined : { filter: 'blur(6px)', transform: 'scale(1.15)' }}
            draggable={false}
          />
        </div>
      ) : (
        <div className="rounded-full w-12 h-12 flex-shrink-0 border border-white/10 bg-white/5 flex items-center justify-center text-cream/20 text-lg">
          👤
        </div>
      )}
      <div className="min-w-0">
        <p className="font-sans text-cream/60 text-xs font-semibold mb-1 flex items-center gap-1.5">
          {revealed ? (member.first_name || 'Guest') : '•••'}
          {member.country && flagUrl(member.country) && (
            <img src={flagUrl(member.country)} alt={member.country} className="h-3.5 rounded-[2px] flex-shrink-0" />
          )}
        </p>
        <p className="font-sans text-cream text-sm italic">
          "{member.career_kid || 'No answer shared'}"
        </p>
      </div>
    </Wrapper>
  );
}

// The group-info popup — everyone else at the table, name and photo both
// blurred/masked until 8pm dinner night, with a way straight into the group
// chat where the icebreakers are already waiting.
export function GlimpseModal({ tableId, onClose }) {
  const [glimpse, setGlimpse] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/portal/glimpse/${tableId}`)
      .then(res => { setGlimpse(res.data.glimpse || []); setRevealed(!!res.data.revealed); })
      .catch(() => setError(true));
  }, [tableId]);

  return (
    <div className="fixed inset-0 z-50 bg-navy/80 backdrop-blur flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-dark-card rounded-2xl border border-white/10 p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif text-2xl text-cream">Group Info</h2>
          <button onClick={onClose} className="text-cream/40 hover:text-cream text-xl">✕</button>
        </div>
        <p className="font-sans text-cream/50 text-sm mb-1">Just a glimpse of people you are meeting</p>
        <p className="font-sans text-cream/30 text-xs mb-4">
          {revealed ? 'Names and photos revealed' : 'Names & photos reveal 8pm on the night'}
        </p>

        {error ? (
          <p className="font-sans text-cream/40 text-sm text-center py-6">Couldn't load your table yet.</p>
        ) : glimpse === null ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {glimpse.map((m, i) => <GlimpseCard key={i} member={m} revealed={revealed} />)}
          </div>
        )}

        <Link to="/portal/group-chat" className="quiz-cta w-full flex items-center justify-center gap-2 mt-6">
          💬 Go to group chat
        </Link>
      </div>
    </div>
  );
}

// Shows exactly one countdown at a time — whichever reveal is next — instead
// of stacking multiple timers. Once both stages are unlocked, the countdown
// disappears and the venue info shows in its place.
function RevealFlow({ revealAt, venueRevealAt, tableId, dinner }) {
  const [now, setNow] = useState(null);
  const [showGlimpse, setShowGlimpse] = useState(false);

  useEffect(() => {
    if (!revealAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [revealAt]);

  if (now === null) return null;

  const glimpseSecondsLeft = Math.max(0, Math.ceil((new Date(revealAt) - now) / 1000));
  const glimpseUnlocked = glimpseSecondsLeft <= 0;
  const venueSecondsLeft = venueRevealAt ? Math.max(0, Math.ceil((new Date(venueRevealAt) - now) / 1000)) : null;
  const venueUnlocked = venueSecondsLeft !== null && venueSecondsLeft <= 0;

  // Reveal windows can be days out right after a table's confirmed, not just
  // the final minutes — so this breaks out days/hours too instead of just
  // ever-climbing raw minutes.
  const format = (secs) => {
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
      : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  };

  return (
    <div className="mt-5">
      {!glimpseUnlocked && (
        <p className="font-sans text-cream/40 text-xs uppercase tracking-widest mb-2 text-center">
          Table reveal unlocks in <span className="text-cream/70 font-semibold">{format(glimpseSecondsLeft)}</span>
        </p>
      )}
      {glimpseUnlocked && !venueUnlocked && venueSecondsLeft !== null && (
        <p className="font-sans text-cream/40 text-xs uppercase tracking-widest mb-2 text-center">
          📍 Venue reveals in <span className="text-cream/70 font-semibold">{format(venueSecondsLeft)}</span>
        </p>
      )}

      {glimpseUnlocked && (
        <button
          onClick={() => setShowGlimpse(true)}
          className="quiz-cta w-full flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>👀</span><span>Group Info</span>
        </button>
      )}

      {venueUnlocked && dinner.restaurant_name && (
        <div className="mt-4 bg-gold/5 rounded-xl p-4 border border-gold/20">
          <p className="font-sans text-gold text-xs uppercase tracking-widest mb-2">📍 Your restaurant</p>
          <p className="font-sans font-semibold text-cream text-base">{dinner.restaurant_name}</p>
          <p className="font-sans text-cream/50 text-sm mt-0.5">{dinner.restaurant_address}</p>
          {dinner.booking_name && (
            <p className="font-sans text-cream/40 text-xs mt-2">Booking under: <span className="text-cream/70">{dinner.booking_name}</span></p>
          )}
          {dinner.menu_price_min && (
            <p className="font-sans text-cream/40 text-xs mt-1">Set menu: <span className="text-gold">${dinner.menu_price_min}–${dinner.menu_price_max} per person</span></p>
          )}
        </div>
      )}

      {showGlimpse && <GlimpseModal tableId={tableId} onClose={() => setShowGlimpse(false)} />}
    </div>
  );
}

// Days out right after booking, not just the final minutes — so this breaks
// out days/hours/minutes/seconds instead of just an ever-climbing count.
function formatCountdown(secs) {
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = secs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function DinnerCard({ dinner, onCancel, onRsvpUpdate }) {
  const [now, setNow] = useState(() => new Date());
  const [rsvpAttending, setRsvpAttending] = useState(dinner.rsvp_attending ?? null);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  // dinner.date is the actual 7pm-NZT dinner-start instant (server-computed,
  // timezone-correct) — used as-is rather than re-deriving "7pm" from a
  // bare date string in the viewer's own local timezone, which would be
  // wrong for anyone not physically on NZ time.
  const dinnerDate = dinner.date ? new Date(dinner.date) : null;

  useEffect(() => {
    if (!dinnerDate) return;
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, [dinner.date]);

  const isPending = dinner.is_pending || !dinner.table_id;
  const isPast = dinnerDate ? dinnerDate < now : false;
  const hoursUntil = dinnerDate ? (dinnerDate - now) / (1000 * 60 * 60) : Infinity;
  // Same 30-minute window the 6:30pm push notification fires in (see
  // server/services/scheduler.js's rsvpPromptAt) — closes once dinner
  // actually starts.
  const rsvpWindowOpen = dinnerDate && !isPast && now >= new Date(dinnerDate.getTime() - 30 * 60 * 1000);

  const respondRsvp = async (value) => {
    if (rsvpSubmitting) return;
    setRsvpSubmitting(true);
    try {
      await api.patch(`/portal/rsvp/${dinner.table_id}`, { attending: value });
      setRsvpAttending(value);
      onRsvpUpdate?.(dinner.table_id, value);
    } catch {
      toast.error('Could not save your response. Try again.');
    } finally {
      setRsvpSubmitting(false);
    }
  };

  let status = 'pending';
  if (!isPending && dinner.table_status === 'confirmed') {
    if (hoursUntil <= 24) status = 'venue';
    else if (hoursUntil <= 48) status = 'glimpse';
    else status = 'matched';
  }

  const config = STATUS_CONFIG[status];

  // The badge stops saying "finding" once matching would normally have
  // happened — Friday 9pm NZT, 94 hours before the Tuesday 7pm dinner —
  // even if the admin's manual match hasn't actually run yet, so the card
  // doesn't look stuck on "finding" for days. Purely cosmetic: isPending
  // and the real countdown/cancel logic are untouched.
  const groupFoundAt = dinnerDate ? new Date(dinnerDate.getTime() - 94 * 3600 * 1000) : null;
  const groupFoundLabelShown = status === 'pending' && groupFoundAt && now >= groupFoundAt;
  const badgeIcon = groupFoundLabelShown ? '✦' : config.icon;
  const badgeLabel = groupFoundLabelShown ? 'Group found' : config.label;

  const formattedDate = dinnerDate
    ? dinnerDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' })
    : dinner.preferred_date || 'Upcoming Tuesday';

  return (
    <div className={`quiz-card ${config.border}`}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-5">
        <span className={`inline-flex items-center gap-2 text-xs font-sans font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full whitespace-nowrap ${config.bg} ${config.color}`}>
          <span>{badgeIcon}</span><span>{badgeLabel}</span>
        </span>
        {!isPast && <span className="font-sans text-cream/30 text-xs">7:00 PM</span>}
      </div>

      {/* Date */}
      <h2 className="font-serif text-2xl text-cream mb-1">{formattedDate}</h2>
      <p className="font-sans text-cream/50 text-sm mb-1">{dinner.city || 'Auckland'}</p>
      {config.description && <p className="font-sans text-cream/40 text-xs mb-4">{config.description}</p>}

      {/* ── STAGE 1: PENDING — what happens next ──
          Reveal timing is always relative to the fixed Tuesday 7pm dinner
          slot, not to table matching, so the countdown here works off
          dinnerDate directly and ticks even before a table is confirmed.
          The venue step only starts its own countdown once the group
          reveal step has finished — they run one at a time, not in
          parallel, matching how RevealFlow behaves post-confirmation. */}
      {status === 'pending' && (() => {
        const groupRevealAt = dinnerDate ? new Date(dinnerDate.getTime() - 48 * 3600 * 1000) : null;
        const groupSecsLeft = groupRevealAt ? Math.max(0, Math.ceil((groupRevealAt - now) / 1000)) : null;
        const groupUnlocked = groupSecsLeft !== null && groupSecsLeft <= 0;
        const venueRevealAt = dinnerDate ? new Date(dinnerDate.getTime() - 24 * 3600 * 1000) : null;
        const venueSecsLeft = venueRevealAt ? Math.max(0, Math.ceil((venueRevealAt - now) / 1000)) : null;

        const steps = [
          { icon: '👀', step: 'Meet your table', secsLeft: groupSecsLeft, unlocked: groupUnlocked, notStarted: false },
          { icon: '📍', step: 'Venue', secsLeft: venueSecsLeft, unlocked: venueSecsLeft !== null && venueSecsLeft <= 0, notStarted: !groupUnlocked },
        ];

        return (
          <div className="mt-5 space-y-3">
            {steps.map(({ icon, step, secsLeft, unlocked, notStarted }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{icon}</span>
                <div className="flex-1 flex items-start justify-between gap-4">
                  <span className="font-sans text-cream/70 text-sm">{step}</span>
                  <div className="text-right flex-shrink-0">
                    {notStarted ? (
                      <span className="font-sans text-cream/20 text-xs italic">Starts after table reveal</span>
                    ) : secsLeft !== null && (
                      <span className="font-sans text-gold text-xs font-semibold">
                        {unlocked ? 'Any moment now' : formatCountdown(secsLeft)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Group locked in onward — one countdown at a time, then reveals ── */}
      {dinner.table_status === 'confirmed' && (
        <RevealFlow
          revealAt={dinner.reveal_at}
          venueRevealAt={dinner.venue_reveal_at}
          tableId={dinner.table_id}
          dinner={dinner}
        />
      )}

      {/* Day-of RSVP — "are you actually coming tonight?" */}
      {dinner.table_status === 'confirmed' && rsvpWindowOpen && (
        <div className="mt-5 pt-5 border-t border-white/[0.06]">
          {rsvpAttending === null ? (
            <>
              <p className="font-sans text-cream text-sm font-medium mb-3">Still coming tonight?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => respondRsvp(true)}
                  disabled={rsvpSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-sans text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  ✓ I'm coming
                </button>
                <button
                  onClick={() => respondRsvp(false)}
                  disabled={rsvpSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 font-sans text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  ✕ Can't make it
                </button>
              </div>
            </>
          ) : rsvpAttending ? (
            <p className="font-sans text-emerald-400 text-sm">✓ You confirmed you're coming tonight</p>
          ) : (
            <p className="font-sans text-red-400 text-sm">✕ You said you can't make it tonight</p>
          )}
        </div>
      )}

      {/* Cancel */}
      {!isPast && (
        <button
          onClick={() => onCancel(dinner)}
          className="mt-5 text-cream/25 hover:text-red-400 font-sans text-xs transition-colors"
        >
          Cancel booking
        </button>
      )}
    </div>
  );
}

const STACK_PHOTO_COUNT = 20;
const STACK_PHOTOS = Array.from(
  { length: STACK_PHOTO_COUNT },
  (_, i) => `/photos/stack/stack-${String(i + 1).padStart(2, '0')}.jpg`
);
// The same set stacks almost all the way through round one; the fade (and
// the intro text typing) starts right as its last two photos are landing,
// not from the beginning of round one.
const STACK_ROUNDS = 2;
const STACK_ITEM_DELAY_MS = 350;
const TEXT_START_COUNT = STACK_PHOTO_COUNT - 2;

// Two fixed lines, each its own always-mounted block, rather than one
// flowing string broken with \n — that still risked a visible jump right
// at the instant the trailing newline entered or left the string (the <p>
// flipping between a 1-line and 2-line box). With both lines permanently
// present (line two just empty until its turn), neither line's DOM node
// ever appears/disappears, so neither can shift position while typing or
// erasing.
const INTRO_LINE_1 = 'Meet people who want to';
const INTRO_LINE_2 = 'meet someone like you.';
const INTRO_TEXT_SPEED_MS = 130;
const INTRO_TEXT_ERASE_SPEED_MS = 40;
// The photo layer's fade is timed to take exactly as long as line one
// takes to type, so by the moment line two ("meet someone like you.")
// starts, every photo has completely faded away rather than the fade
// finishing early or still being mid-flight into line two.
const PHOTO_FADE_MS = INTRO_LINE_1.length * INTRO_TEXT_SPEED_MS;
// Held for a beat once the sentence finishes typing, before it reverse-
// erases back to nothing.
const INTRO_TEXT_HOLD_MS = 700;
// Then held blank for a beat before the whole screen fades into the real
// dashboard/pre-profile content.

// Types line one, then line two, holds, reverse-erases both back to
// nothing, then types finalWord ("Location") into line one's same spot —
// which is also exactly where the real Location heading sits next, so the
// handoff needs no fade of its own. onDone fires once finalWord is fully
// typed; the caller reveals the real screen immediately at that point,
// letting that screen's own elements fade in around the already-visible
// word instead of the whole thing cross-fading.
function IntroText({ line1, line2, finalWord, start, speed = INTRO_TEXT_SPEED_MS, eraseSpeed = INTRO_TEXT_ERASE_SPEED_MS, holdMs = INTRO_TEXT_HOLD_MS, onDone, className, style }) {
  const [shown1, setShown1] = useState('');
  const [shown2, setShown2] = useState('');
  const [phase, setPhase] = useState('idle');

  useEffect(() => {
    if (!start) return;
    setPhase('typing1');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown1(line1.slice(0, i));
      if (i >= line1.length) {
        clearInterval(id);
        setPhase('typing2');
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, line1]);

  useEffect(() => {
    if (phase !== 'typing2') return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown2(line2.slice(0, i));
      if (i >= line2.length) {
        clearInterval(id);
        setPhase('holding');
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, line2, speed]);

  useEffect(() => {
    if (phase !== 'holding') return;
    const t = setTimeout(() => setPhase('erasing2'), holdMs);
    return () => clearTimeout(t);
  }, [phase, holdMs]);

  useEffect(() => {
    if (phase !== 'erasing2') return;
    let i = line2.length;
    const id = setInterval(() => {
      i -= 1;
      setShown2(line2.slice(0, Math.max(i, 0)));
      if (i <= 0) {
        clearInterval(id);
        setPhase('erasing1');
      }
    }, eraseSpeed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, line2, eraseSpeed]);

  useEffect(() => {
    if (phase !== 'erasing1') return;
    let i = line1.length;
    const id = setInterval(() => {
      i -= 1;
      setShown1(line1.slice(0, Math.max(i, 0)));
      if (i <= 0) {
        clearInterval(id);
        setPhase(finalWord ? 'typingFinal' : 'done');
        if (!finalWord) onDone?.();
      }
    }, eraseSpeed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, line1, eraseSpeed, finalWord]);

  useEffect(() => {
    if (phase !== 'typingFinal') return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown1(finalWord.slice(0, i));
      if (i >= finalWord.length) {
        clearInterval(id);
        setPhase('done');
        onDone?.();
      }
    }, speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finalWord, speed]);

  if (!start) return null;

  const caretOn1 = phase === 'typing1' || phase === 'erasing1' || phase === 'typingFinal';
  const caretOn2 = phase === 'typing2' || phase === 'holding' || phase === 'erasing2';
  const caret = <span className="inline-block w-[2px] h-[0.9em] align-middle ml-1 bg-navy animate-pulse" />;

  // nowrap so a line can never wrap onto an extra sub-line as it grows —
  // that would change this block's total height, which (since it's
  // vertically centered by the screen's own flex layout) would shift both
  // lines up or down as a unit even though each line's own top/left stays
  // fixed.
  return (
    <div className={className} style={style}>
      <p style={{ whiteSpace: 'nowrap' }}>{shown1}{caretOn1 && caret}</p>
      <p style={{ whiteSpace: 'nowrap' }}>{shown2}{caretOn2 && caret}</p>
    </div>
  );
}
// Fixed per-photo rotation/offset (not randomized on each render, which
// would make the pile reshuffle on every re-render) so it reads as a
// tossed stack of prints rather than a perfectly centered grid.
// Kept to a narrow +-6deg range on purpose — a full-bleed cover needs to be
// scaled up enough that its rotated edge still runs off-screen on every
// side, and wider angles demand a much heavier (visibly zoomed-in) scale to
// avoid corner gaps. A tighter range keeps the cover close to its native
// framing while still reading as a loosely tossed stack.
const STACK_TRANSFORMS = [
  { rotate: -4, x: -6, y: 4 }, { rotate: 3, x: 8, y: -3 }, { rotate: -2, x: 4, y: 6 },
  { rotate: 5, x: -10, y: -5 }, { rotate: -5.5, x: 2, y: 8 }, { rotate: 2.5, x: -7, y: -8 },
  { rotate: -3, x: 9, y: 2 }, { rotate: 4.5, x: -3, y: -6 }, { rotate: -1.5, x: 6, y: 9 },
  { rotate: 3.5, x: -9, y: 3 }, { rotate: -4.5, x: 3, y: -4 }, { rotate: 2, x: -5, y: 7 },
  { rotate: -3.5, x: 7, y: -9 }, { rotate: 5.5, x: -4, y: 5 }, { rotate: -2.5, x: 5, y: -7 },
  { rotate: 4, x: -8, y: -2 }, { rotate: -5, x: 10, y: 4 }, { rotate: 1.5, x: -2, y: -9 },
  { rotate: -6, x: 6, y: 6 }, { rotate: 3, x: -6, y: -5 },
];

export default function PortalDashboard() {
  const { attendeeUser, logout } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [round1Done, setRound1Done] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [introHoldDone, setIntroHoldDone] = useState(false);

  // Cached (stale-while-revalidate): a repeat visit shows what was here last
  // time instantly, while a fresh copy loads quietly in the background — see
  // utils/useCachedFetch. A brand-new account (or one that hasn't finished
  // onboarding) has no Firestore profile doc yet, which the API reports as a
  // 404 — folded into the cached "data" itself (needsProfile: true) rather
  // than treated as a load error, same as before.
  const {
    data: profileData,
    loading: profileLoading,
    error: profileLoadError,
    setData: setProfileData,
  } = useCachedFetch('portal_profile', async () => {
    try {
      const res = await api.get('/portal/profile');
      return { user: res.data.user, hasActiveSubscription: !!res.data.hasActiveSubscription, needsProfile: false };
    } catch (err) {
      if (err.response?.status === 404) {
        return { user: null, hasActiveSubscription: false, needsProfile: true };
      }
      throw err;
    }
  });

  const { data: dinnersData, loading: dinnersLoading, setData: setDinnersData } = useCachedFetch(
    'portal_dinners',
    async () => (await api.get('/portal/dinners')).data.dinners || []
  );

  const loading = profileLoading || dinnersLoading;
  const showIntro = loading || !introHoldDone;
  const loadError = profileLoadError;
  const needsProfile = profileData?.needsProfile ?? false;
  const profile = profileData?.user ?? null;
  const hasActiveSubscription = profileData?.hasActiveSubscription ?? false;
  const dinners = dinnersData ?? [];

  // Warms every other tab's cache as soon as the dashboard itself has
  // loaded, so opening Group Chats/Connections/Album/Edit Profile for the
  // first time in a session still renders instantly instead of showing a
  // loading state once each. Skipped for a brand-new account still mid-
  // onboarding — those endpoints would just return empty results anyway.
  useEffect(() => {
    if (!loading && !needsProfile) prefetchPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, needsProfile]);

  // Drives the stack's pacing directly off a real timer rather than
  // Framer Motion's own per-item `delay` — with `duration: 0` that delay
  // isn't reliably honored (onAnimationComplete can fire almost
  // immediately regardless of the delay set), which was making every
  // photo land in a rush instead of one every 350ms.
  useEffect(() => {
    const total = STACK_PHOTO_COUNT * STACK_ROUNDS;
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      setRevealedCount(count);
      // Fires well before round one's own 20 photos finish landing — the
      // photo layer's fade and the text typing both start partway through
      // round one instead of waiting for it to fully stack first.
      if (count === TEXT_START_COUNT) setRound1Done(true);
      if (count >= total) clearInterval(id);
    }, STACK_ITEM_DELAY_MS);
    return () => clearInterval(id);
  }, []);

  // A dinner's own RSVP response happens inside DinnerCard (its own local
  // state, since each card ticks its own countdown) — this is how that
  // answer also lands in the cached list, so a later visit doesn't briefly
  // show the "still coming tonight?" prompt again before revalidating.
  const updateRsvpCache = (tableId, attending) => {
    setDinnersData(prev => (prev || []).map(d => d.table_id === tableId ? { ...d, rsvp_attending: attending } : d));
  };

  // A pending (not yet matched) booking has no table_id at all — cancelling
  // it goes through a different endpoint that just removes the booking
  // doc directly instead of looking up a table that doesn't exist yet.
  const cancelBooking = async (dinner) => {
    if (!confirm('Cancel this booking? Refunds take 2-3 working days.')) return;
    try {
      const res = dinner.is_pending
        ? await api.post(`/portal/cancel-pending/${dinner.booking_id}`)
        : await api.post(`/portal/cancel/${dinner.table_id}`);
      toast.success(res.data.message);
      setDinnersData(prev => (prev || []).filter(d => dinner.is_pending ? d.booking_id !== dinner.booking_id : d.table_id !== dinner.table_id));
    } catch (err) {
      // Inside 24h of dinner, self-cancel is blocked server-side — that gets
      // its own modal (with the contact email front and centre) rather than
      // just a toast, since it needs a real next step, not just "no".
      if (err.response?.data?.contactRequired) {
        setShowContactModal(true);
      } else {
        toast.error(err.response?.data?.error || 'Could not cancel that booking.');
      }
    }
  };

  // Replaces the old dark loading skeleton, which visually read as "the
  // dashboard" flashing up before snapping to the light pre-profile screen.
  // Photos stack twice; once round one lands, the photo layer itself fades
  // (revealing the beige underneath, not the whole screen) while round two
  // keeps landing and the intro sentence types over it. Once that sentence
  // finishes and holds a beat, the whole screen fades into whichever real
  // screen (dashboard or pre-profile) is about to follow.
  // Mirrors the needsProfile screen's exact chrome below (nav height,
  // eyebrow spacing, pl-2, text-3xl Permanent Marker) so the intro text
  // sits in the identical spot the "Location" heading occupies next. After
  // erasing, it types "Location" itself into that same spot, then hands
  // off immediately (no fade of its own) — the real screen's other
  // elements fade in around that already-visible word instead.
  if (showIntro) return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: '#E7DFC5' }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity ease-in-out"
        style={{ transitionDuration: `${PHOTO_FADE_MS}ms`, opacity: round1Done ? 0 : 1 }}
      >
        <div className="relative" style={{ width: 'min(98vw, 540px)', height: 'min(86vh, 660px)' }}>
          {Array.from({ length: STACK_PHOTO_COUNT * STACK_ROUNDS }, (_, i) => {
            const src = STACK_PHOTOS[i % STACK_PHOTO_COUNT];
            const t = STACK_TRANSFORMS[i % STACK_TRANSFORMS.length];
            return (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-sm bg-white p-2.5 shadow-lg"
                style={{ zIndex: i, rotate: t.rotate, x: t.x * 2, y: t.y * 2, opacity: i < revealedCount ? 1 : 0 }}
              >
                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
              </motion.div>
            );
          })}
        </div>
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 py-5" aria-hidden="true">
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="" className="h-7 opacity-0" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 space-y-8">
        <div className="text-center" aria-hidden="true">
          <p className="font-sans text-xs tracking-[0.2em] uppercase mb-3 opacity-0">Welcome to HeyDer</p>
        </div>

        <div className="pl-2">
          <IntroText
            line1={INTRO_LINE_1}
            line2={INTRO_LINE_2}
            finalWord="Location"
            start={round1Done}
            onDone={() => setIntroHoldDone(true)}
            className="text-3xl text-navy leading-snug"
            style={{ fontFamily: "'Permanent Marker', cursive" }}
          />
        </div>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="quiz-bg min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="font-serif text-2xl text-cream mb-3">Couldn't load your dashboard</p>
        <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
        <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
      </div>
    </div>
  );

  // No fade on the outer screen or the Location label itself — when
  // arriving from the intro, that word is already sitting here typed out,
  // so it stays put with zero visual change. Everything around it (nav,
  // eyebrow, dropdown, the rest) fades in on its own instead, which is
  // what actually reads as "the rest of the screen appearing".
  if (needsProfile || (profile && !profile.profileComplete)) {
    const revealFade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.9, ease: 'easeInOut' } };
    return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#E7DFC5' }}>
      <motion.nav {...revealFade} className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-navy/10">
        <Link to="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        </Link>
        <button onClick={async () => { await logout(); navigate('/'); }} className="font-sans text-navy/50 text-xs hover:text-navy transition-colors">
          Sign out
        </button>
      </motion.nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 space-y-8">
        <motion.div {...revealFade} className="text-center">
          <p className="font-sans text-navy/50 text-xs tracking-[0.2em] uppercase mb-3">Welcome to HeyDer</p>
        </motion.div>

        <div className="space-y-1">
          <label className="text-navy text-3xl block pl-2" style={{ fontFamily: "'Permanent Marker', cursive" }}>Location</label>
          <motion.div {...revealFade}>
            <CityDropdown value={location} onChange={setLocation} />
          </motion.div>
        </div>

        {location && location !== 'Auckland' && (
          <motion.div {...revealFade} className="text-center">
            <p className="font-sans text-navy/60 text-sm leading-relaxed">
              We're currently curating dinners only in Auckland. We'll let you know when we expand to {location}.
            </p>
          </motion.div>
        )}

        {location === 'Auckland' && (
          <motion.div {...revealFade}>
            <Link
              to="/profile"
              onClick={() => {
                // Quiz.jsx (mounted at /profile) picks this up and includes it
                // in the submission — this selector used to be purely cosmetic,
                // the picked city never actually reached the server.
                sessionStorage.setItem('heyder_signup_city', location);
              }}
              className="w-full inline-flex items-center justify-center gap-2 border-2 border-navy text-navy font-sans font-semibold text-base tracking-wide px-8 py-4 rounded-2xl transition-all duration-200 hover:bg-navy hover:text-cream"
            >
              Build My Profile →
            </Link>
          </motion.div>
        )}

        <motion.div {...revealFade} className="border-t border-navy/10 pt-8">
          <button
            type="button"
            onClick={() => setHowItWorksOpen(o => !o)}
            className="w-full flex items-center justify-between font-sans font-semibold text-navy text-sm"
          >
            How HeyDer works
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="text-navy/50 transition-transform duration-200 flex-shrink-0"
              style={{ transform: howItWorksOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{ maxHeight: howItWorksOpen ? '500px' : '0px', opacity: howItWorksOpen ? 1 : 0 }}
          >
            <div className="space-y-5 pt-5">
              {[
                ['①', 'Build your profile', 'A few quick questions about you and who you want to meet.'],
                ['②', 'Book your spot', 'Reserve your seat at this week\'s dinner.'],
                ['③', "We'll find your group", 'A curated table of people who wanted to meet someone like you.'],
                ['④', 'Just show up', 'Every Tuesday, 7pm, Auckland. Food & drinks paid at the venue.'],
              ].map(([num, title, body]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="font-serif text-navy/70 text-lg leading-none mt-0.5">{num}</span>
                  <div>
                    <p className="font-sans text-navy text-sm font-medium">{title}</p>
                    <p className="font-sans text-navy/50 text-xs mt-0.5 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
    );
  }

  const upcoming = dinners.filter(d => d.is_pending || !d.date || new Date(d.date) >= new Date());
  const past = dinners.filter(d => !d.is_pending && d.date && new Date(d.date) < new Date());

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        </Link>
        <div className="flex items-center gap-3">
          <img src={profile?.photo || AVATAR} alt="Account" className="w-8 h-8 rounded-full border border-gold/30 object-cover" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="font-sans text-cream/40 text-xs hover:text-cream transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">

        {/* Profile header */}
        <div className="flex items-center gap-3">
          <img
            src={profile?.photo || AVATAR}
            alt=""
            className="w-14 h-14 rounded-full border-2 border-gold/40 object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl text-cream truncate">
              {profile?.first_name}
            </h1>
            {hasActiveSubscription && (
              <span className="inline-block mt-1 font-sans text-[10px] tracking-widest uppercase text-gold bg-gold/10 border border-gold/20 rounded-full px-2.5 py-0.5">
                ✦ Subscription active
              </span>
            )}
          </div>
          <Link
            to="/portal/profile"
            className="font-sans text-gold text-xs hover:text-yellow transition-colors whitespace-nowrap"
          >
            Edit →
          </Link>
        </div>

        {/* Upcoming dinners */}
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map(d => (
              <DinnerCard key={d.table_id} dinner={d} onCancel={cancelBooking} onRsvpUpdate={updateRsvpCache} />
            ))}
          </div>
        ) : (
          <div className="quiz-card text-center">
            <p className="font-serif text-2xl text-cream mb-2">No dinners booked yet.</p>
            <p className="font-sans text-cream/50 text-sm mb-6 leading-relaxed">
              Your table is waiting. Takes 5 minutes to sign up.
            </p>
            <Link to="/portal/book" className="quiz-cta text-sm">Book a dinner</Link>
          </div>
        )}

        {/* Past dinners */}
        {past.length > 0 && (
          <div>
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest mb-3">Past dinners</p>
            <div className="space-y-2">
              {past.map(d => (
                <div key={d.table_id} className="rounded-xl border border-white/5 px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(231,220,189,0.02)' }}>
                  <div>
                    <p className="font-sans text-cream/60 text-sm">
                      {new Date(d.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' })}
                    </p>
                    {d.restaurant_name && <p className="font-sans text-cream/35 text-xs mt-0.5">{d.restaurant_name}</p>}
                  </div>
                  {d.has_feedback ? (
                    <span className="font-sans text-emerald-400/70 text-xs">✓ Feedback sent</span>
                  ) : (
                    <Link
                      to={`/feedback/${d.dinner_id}?uid=${attendeeUser?.uid}`}
                      className="font-sans text-gold text-xs hover:text-yellow transition-colors"
                    >
                      Rate your experience →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="font-sans text-cream/25 text-xs text-center pb-4">
          Questions? <a href="mailto:info@heyder.nz" className="text-gold/60 hover:text-gold transition-colors">info@heyder.nz</a>
        </p>
      </div>

      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowContactModal(false)}>
          <div className="quiz-card w-full max-w-sm space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <p className="font-serif text-xl text-cream">Too close to dinner to cancel</p>
            <p className="font-sans text-cream/60 text-sm leading-relaxed">
              Cancellations within 24 hours of dinner can't be self-served — the table's already been booked. Email us and we'll sort it out.
            </p>
            <a
              href="mailto:info@heyder.nz"
              className="quiz-cta w-full flex items-center justify-center"
            >
              info@heyder.nz
            </a>
            <button
              onClick={() => setShowContactModal(false)}
              className="font-sans text-cream/40 hover:text-cream text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <OnboardingTour />
      <BottomNav />
    </div>
  );
}
