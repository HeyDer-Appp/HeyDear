import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { openCheckout } from '../../utils/checkout';
import { success as hapticSuccess } from '../../utils/haptics';
import BottomNav from '../../components/BottomNav';
import { flagUrl } from '../../utils/flags';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { prefetchPortalData } from '../../utils/prefetch';
import { Users, MapPin, Clock } from 'lucide-react';

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

// Booking for a given Tuesday closes 6pm NZT the Sunday before it — two
// days out, giving the venue side the whole week to plan instead of a
// last-minute headcount. Once that cutoff passes for the nearest Tuesday,
// it drops off the list and the window rolls forward, so there are always
// exactly 3 real options. Dates are tracked as UTC-midnight values that
// stand in for NZ calendar days (not real UTC instants) — comparisons all
// happen on that same artificial axis, so this doesn't need real
// timezone-offset math, and formatting uses timeZone: 'UTC' so the browser
// doesn't reinterpret it through the viewer's own device timezone.
function nzNowMillis() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

function getNextTuesdayOptions(count = 3) {
  const nowMillis = nzNowMillis();
  let cursor = new Date(nowMillis);
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
  while (cursor.getUTCDay() !== 2) cursor = new Date(cursor.getTime() + 86400000);

  const options = [];
  while (options.length < count) {
    const cutoff = cursor.getTime() - 2 * 86400000 + 18 * 3600000; // Sunday 18:00, 2 days before
    if (nowMillis < cutoff) options.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  return options;
}

function formatTuesdayOption(date) {
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// The two inline pills that make up "Book my dinner on <date> in <city>
// city" — small dropdown buttons sitting inside a flowing sentence rather
// than a full-width form field, matching the approved mockup.
function InlineDatePill({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const options = React.useMemo(() => getNextTuesdayOptions(3), []);
  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 font-sans text-[0.62em] align-middle"
        style={{
          background: 'transparent',
          border: '1.5px solid rgba(117,68,113,0.55)',
          boxShadow: 'inset 0 2px 4px rgba(22,24,29,0.25), inset 0 -1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <span style={{ color: value ? '#754471' : 'rgba(117,68,113,0.5)' }}>{value ? formatTuesdayOption(value) : 'choose date'}</span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ color: '#754471', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span
          className="absolute left-1/2 mt-1.5 rounded-2xl overflow-hidden block"
          style={{
            transform: 'translateX(-50%)',
            width: '180px',
            zIndex: 50,
            background: 'rgba(231,223,197,0.95)',
            border: '1px solid rgba(22,24,29,0.12)',
            boxShadow: '0 10px 28px rgba(22,24,29,0.12)',
          }}
        >
          {options.map(date => (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => { onChange(date); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 font-sans text-sm text-navy hover:bg-navy/5 transition-colors block"
            >
              {formatTuesdayOption(date)}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function InlineCityPill({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 font-sans text-[0.62em] align-middle"
        style={{
          background: 'transparent',
          border: '1.5px solid rgba(117,68,113,0.55)',
          boxShadow: 'inset 0 2px 4px rgba(22,24,29,0.25), inset 0 -1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <span style={{ color: '#754471' }}>{value}</span>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ color: '#754471', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <span
          className="absolute left-1/2 mt-1.5 rounded-2xl overflow-hidden block"
          style={{
            transform: 'translateX(-50%)',
            width: '160px',
            zIndex: 50,
            background: 'rgba(231,223,197,0.95)',
            border: '1px solid rgba(22,24,29,0.12)',
            boxShadow: '0 10px 28px rgba(22,24,29,0.12)',
          }}
        >
          {PRE_PROFILE_CITIES.map(city => (
            <button
              key={city}
              type="button"
              onClick={() => { onChange(city); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 font-sans text-sm text-navy hover:bg-navy/5 transition-colors block"
            >
              {city}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

const STATUS_CONFIG = {
  pending: {
    border: 'border-plum/20',
    description: '',
  },
  matched: {
    border: 'border-plum/20',
    description: '',
  },
  glimpse: {
    border: 'border-purple-500/20',
    description: '',
  },
  venue: {
    border: 'border-emerald-400/20',
    description: '',
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
    <Wrapper {...wrapperProps} className={`flex items-center gap-3 bg-white/30 rounded-xl p-3 border border-navy/10 ${revealed ? 'hover:border-plum/30 hover:scale-[1.02] transition-all duration-300' : ''}`}>
      {member.photo ? (
        <div className="rounded-full overflow-hidden w-12 h-12 flex-shrink-0 border border-navy/15">
          <img
            src={member.photo}
            alt=""
            className="w-full h-full object-cover transition-[filter] duration-700"
            style={revealed ? undefined : { filter: 'blur(6px)', transform: 'scale(1.15)' }}
            draggable={false}
          />
        </div>
      ) : (
        <div className="rounded-full w-12 h-12 flex-shrink-0 border border-navy/15 bg-white/40 flex items-center justify-center text-navy/35 text-lg">
          👤
        </div>
      )}
      <div className="min-w-0">
        <p className="font-sans text-navy/72 text-xs font-semibold mb-1 flex items-center gap-1.5">
          {revealed ? (member.first_name || 'Guest') : '•••'}
          {member.country && flagUrl(member.country) && (
            <img src={flagUrl(member.country)} alt={member.country} className="h-3.5 rounded-[2px] flex-shrink-0" />
          )}
        </p>
        <p className="font-sans text-navy text-sm italic">
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
    <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-cream rounded-2xl border border-navy/15 p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif font-bold text-2xl text-navy">Your table</h2>
          <button onClick={onClose} className="text-navy/55 hover:text-navy text-xl">✕</button>
        </div>
        <p className="font-sans text-navy/45 text-xs mb-4">
          {revealed ? '' : 'Names at 8pm'}
        </p>

        {error ? (
          <p className="font-sans text-navy/55 text-sm text-center py-6">Not yet.</p>
        ) : glimpse === null ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {glimpse.map((m, i) => <GlimpseCard key={i} member={m} revealed={revealed} />)}
          </div>
        )}

        <Link to="/portal/group-chat" className="plum-cta w-full flex items-center justify-center gap-2 mt-6">
          Chat
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
        <p className="font-sans text-navy/55 text-xs uppercase tracking-widest mb-2 text-center">
          Table in <span className="text-navy/80 font-semibold">{format(glimpseSecondsLeft)}</span>
        </p>
      )}
      {glimpseUnlocked && !venueUnlocked && venueSecondsLeft !== null && (
        <p className="font-sans text-navy/55 text-xs uppercase tracking-widest mb-2 text-center">
          📍 Venue in <span className="text-navy/80 font-semibold">{format(venueSecondsLeft)}</span>
        </p>
      )}

      {glimpseUnlocked && (
        <button
          onClick={() => setShowGlimpse(true)}
          className="plum-cta w-full flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>👀</span><span>Your table</span>
        </button>
      )}

      {venueUnlocked && dinner.restaurant_name && (
        <div className="mt-4 bg-plum/5 rounded-xl p-4 border border-plum/20">
          <p className="font-sans text-plum text-xs uppercase tracking-widest mb-2">📍 Venue</p>
          <p className="font-sans font-semibold text-navy text-base">{dinner.restaurant_name}</p>
          <p className="font-sans text-navy/65 text-sm mt-0.5">{dinner.restaurant_address}</p>
          {dinner.booking_name && (
            <p className="font-sans text-navy/55 text-xs mt-2">Under: <span className="text-navy/80">{dinner.booking_name}</span></p>
          )}
          {dinner.menu_price_min && (
            <p className="font-sans text-navy/55 text-xs mt-1">Menu: <span className="text-plum">${dinner.menu_price_min}–${dinner.menu_price_max} pp</span></p>
          )}
          {dinner.afterparty_name && (
            <div className="mt-3 pt-3 border-t border-plum/15">
              <p className="font-sans text-plum text-xs uppercase tracking-widest mb-1">🎉 After-party</p>
              <p className="font-sans font-semibold text-navy text-sm">{dinner.afterparty_activity ? `${dinner.afterparty_activity} · ` : ''}{dinner.afterparty_name}</p>
              {dinner.afterparty_address && <p className="font-sans text-navy/65 text-xs mt-0.5">{dinner.afterparty_address}</p>}
              {dinner.afterparty_note && <p className="font-sans text-navy/55 text-xs mt-1">{dinner.afterparty_note}</p>}
            </div>
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
      hapticSuccess();
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

  const formattedDate = dinnerDate
    ? dinnerDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' })
    : dinner.preferred_date || 'Upcoming Tuesday';

  const dateParts = dinnerDate ? (() => {
    const o = { timeZone: 'Pacific/Auckland' };
    return {
      weekday: dinnerDate.toLocaleDateString('en-NZ', { ...o, weekday: 'long' }),
      day: dinnerDate.toLocaleDateString('en-NZ', { ...o, day: 'numeric', month: 'long' }),
      year: dinnerDate.toLocaleDateString('en-NZ', { ...o, year: 'numeric' }),
    };
  })() : null;

  // Journey stepper — Booked / Group / Venue / Dinner. doneCount is the
  // index (0-based) of whichever checkpoint is currently active (still in
  // progress); everything before it is fully done, everything after is
  // still ahead. isPast pushes it one past the last checkpoint so all four
  // read as complete instead of the final one sitting "active" forever.
  let doneCount = 1;
  if (status === 'glimpse') doneCount = 2;
  else if (status === 'venue') doneCount = 3;
  if (isPast) doneCount = 4;

  const groupRevealMs = dinnerDate ? dinnerDate.getTime() - 48 * 3600 * 1000 : null;
  const venueRevealMs = dinnerDate ? dinnerDate.getTime() - 24 * 3600 * 1000 : null;
  const dinnerMs = dinnerDate ? dinnerDate.getTime() : null;
  // No real "booked at" timestamp is available here, so the first segment's
  // start is approximated as a week before group reveal — close enough for
  // a purely decorative fill, unlike the other two segments which use the
  // real 24h reveal windows.
  const bookedMs = groupRevealMs != null ? groupRevealMs - 7 * 24 * 3600 * 1000 : null;
  const nowMs = now.getTime();
  const segmentFill = (startMs, endMs) => {
    if (startMs == null || endMs == null || endMs <= startMs) return 0;
    return Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs)));
  };
  const segmentBounds = [[bookedMs, groupRevealMs], [groupRevealMs, venueRevealMs], [venueRevealMs, dinnerMs]];
  const segProgress = segmentBounds.map(([start, end], i) => {
    if (doneCount > i + 1) return 1;
    if (doneCount === i + 1) return segmentFill(start, end);
    return 0;
  });
  const CHECKPOINTS = ['Booked', 'Group', 'Venue', 'Dinner'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-card ${config.border}`}
    >
      {/* Date */}
      <div className="flex items-center justify-between mb-2">
        <p className="font-sans font-semibold text-plum text-[9px] uppercase tracking-[0.22em]">{dateParts ? dateParts.weekday : 'Upcoming'}</p>
        {!isPast && <span className="font-sans text-navy/70 text-[10px] font-medium border border-navy/15 rounded-full px-2 py-0.5 tabular-nums">7:00 PM</span>}
      </div>
      {dateParts ? (
        <>
          <h2 className="font-serif font-bold text-navy text-2xl leading-none">{dateParts.day}</h2>
          <p className="font-sans text-navy/60 text-xs mt-2 flex items-center gap-1.5">
            {dateParts.year}
            <span className="text-navy/25">·</span>
            <MapPin size={12} strokeWidth={2} className="text-plum" />
            {dinner.city || 'Auckland'}
          </p>
        </>
      ) : (
        <>
          <h2 className="font-serif font-bold text-navy text-3xl leading-tight">{formattedDate}</h2>
          <p className="font-sans text-navy/60 text-sm mt-2">{dinner.city || 'Auckland'}</p>
        </>
      )}
      {config.description && <p className="font-sans text-navy/55 text-xs mt-3">{config.description}</p>}

      <div className="h-px bg-navy/10 my-4" />

      {/* Journey stepper — diamond checkpoints, the line into whichever one
          is currently active fills with plum as that milestone approaches. */}
      <div className="flex items-center mb-2">
        {CHECKPOINTS.map((label, i) => (
          <React.Fragment key={label}>
            <div
              className="flex-shrink-0"
              style={{
                width: 13,
                height: 13,
                transform: 'rotate(45deg)',
                background: i < doneCount ? '#754471' : (i === doneCount ? 'transparent' : 'rgba(22,24,29,0.12)'),
                border: i === doneCount && !isPast ? '2px solid #754471' : 'none',
                boxShadow: i === doneCount && !isPast ? '0 0 0 5px rgba(117,68,113,0.16)' : 'none',
                transition: 'background 0.4s ease',
              }}
            />
            {i < CHECKPOINTS.length - 1 && (
              <div className="flex-1 relative" style={{ height: 1.5, background: 'rgba(22,24,29,0.12)', margin: '0 2px' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#754471',
                    width: `${segProgress[i] * 100}%`,
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between">
        {CHECKPOINTS.map(label => (
          <span key={label} className="font-sans text-navy/45 uppercase" style={{ fontSize: '8.5px', letterSpacing: '0.03em' }}>{label}</span>
        ))}
      </div>


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

        // Venue only appears once the group itself has been revealed —
        // showing it ahead of time (even as a greyed-out "after table" row)
        // implied it was its own independent countdown, when it's really a
        // second step that only makes sense once the first has happened.
        const steps = [
          { Icon: Users, step: 'Your table', sub: '48h before dinner', secsLeft: groupSecsLeft, unlocked: groupUnlocked },
          ...(groupUnlocked
            ? [{ Icon: MapPin, step: 'Venue', sub: '24h before dinner', secsLeft: venueSecsLeft, unlocked: venueSecsLeft !== null && venueSecsLeft <= 0 }]
            : []),
        ];

        return (
          <div className="mt-4 divide-y divide-navy/10">
            {steps.map(({ Icon, step, sub, secsLeft, unlocked }) => (
              <div key={step} className="flex items-center gap-3 py-2.5 first:pt-0.5 last:pb-0.5">
                <span className="w-8 h-8 rounded-full bg-plum/10 text-plum flex items-center justify-center flex-shrink-0">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-semibold text-navy text-base leading-tight">{step}</p>
                  <p className="font-sans text-navy/45 text-[10px] mt-0.5">{sub}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {unlocked ? (
                    <span className="inline-flex items-center gap-1.5 font-sans text-plum text-[10px] font-semibold bg-plum/10 rounded-full px-2.5 py-0.5">
                      <span className="w-1 h-1 rounded-full bg-plum" />Open now
                    </span>
                  ) : secsLeft !== null && (
                    <span className="font-sans text-plum text-xs font-semibold tabular-nums">{formatCountdown(secsLeft)}</span>
                  )}
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
        <div className="mt-5 pt-5 border-t border-navy/10">
          {rsvpAttending === null ? (
            <>
              <p className="font-sans text-navy text-sm font-medium mb-3">Coming tonight?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => respondRsvp(true)}
                  disabled={rsvpSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 font-sans text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  ✓ Yes
                </button>
                <button
                  onClick={() => respondRsvp(false)}
                  disabled={rsvpSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-700 font-sans text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  ✕ No
                </button>
              </div>
            </>
          ) : rsvpAttending ? (
            <p className="font-sans text-emerald-700 text-sm">✓ You're coming</p>
          ) : (
            <p className="font-sans text-red-700 text-sm">✕ Not coming</p>
          )}
        </div>
      )}

      {/* Cancel — hidden once a confirmed dinner is past (nothing left to
          cancel), but a pending booking that never got matched to a table
          stays cancellable even past its date. Its own cancel-pending
          endpoint has no 24h cutoff (nothing was ever reserved), and
          without this, a booking stuck in that state has no way to clear
          it and blocks rebooking forever. */}
      {(!isPast || isPending) && (
        <div className="mt-4 pt-3 border-t border-navy/10">
          <button
            onClick={() => onCancel(dinner)}
            className="text-navy/45 hover:text-red-700 font-sans text-xs tracking-wide transition-colors"
          >
            Cancel booking
          </button>
        </div>
      )}
    </motion.div>
  );
}

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
function IntroText({ line1, line2, finalWord, finalWordSize = '1.875rem', start, speed = INTRO_TEXT_SPEED_MS, eraseSpeed = INTRO_TEXT_ERASE_SPEED_MS, holdMs = INTRO_TEXT_HOLD_MS, onDone, className, style }) {
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
  // that would change this block's total height and shift both lines up
  // or down as a unit even though each line's own top/left stays fixed.
  //
  // The sentence itself gets a fluid clamp() size instead of a fixed one:
  // at the real heading's text-3xl size, a 20+ character line comfortably
  // fits a desktop test viewport but overflows off the edge of an actual
  // narrow phone screen (nowrap means it can't wrap to compensate — it
  // just runs off). clamp() scales it down on narrow screens while still
  // reaching text-3xl-ish on wider ones. Once typingFinal/done starts
  // ("Location" itself, always short), line one switches to the fixed
  // finalWordSize so it matches the real heading exactly.
  const sentenceSize = 'clamp(1.1rem, 6vw, 1.875rem)';
  const isFinalPhase = phase === 'typingFinal' || phase === 'done';

  return (
    <div className={className} style={style}>
      <p style={{ whiteSpace: 'nowrap', fontSize: isFinalPhase ? finalWordSize : sentenceSize }}>{shown1}{caretOn1 && caret}</p>
      <p style={{ whiteSpace: 'nowrap', fontSize: sentenceSize }}>{shown2}{caretOn2 && caret}</p>
    </div>
  );
}

export default function PortalDashboard() {
  const { attendeeUser, logout } = useAuth();
  const navigate = useNavigate();
  // Arriving straight from the profile-completion video: Quiz.jsx has already
  // dissolved the video into this same map background, so the map is simply
  // there from the first frame (no fade of its own), and the nav/content on
  // top of it fades in slowly afterward. Every other arrival keeps the normal
  // portal-bg fade-in untouched.
  const routerLocation = useLocation();
  const justCompletedProfile = !!routerLocation.state?.justCompletedProfile;
  const [dashboardRevealed, setDashboardRevealed] = useState(!justCompletedProfile);
  // After the handoff, the pieces appear one after another (header + icons,
  // then the main box, then the bottom bar) rather than all at once.
  const handoffReveal = (delayMs) => (justCompletedProfile
    ? { opacity: dashboardRevealed ? 1 : 0, transition: `opacity 2400ms ease-out ${delayMs}ms` }
    : undefined);
  const [location, setLocation] = useState('');
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingCity, setBookingCity] = useState('Auckland');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPastDinners, setShowPastDinners] = useState(false);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);
  const [matchAvatars, setMatchAvatars] = useState([]);

  // Same as Quiz.jsx/BookDinner.jsx's own check: in the in-app checkout
  // sheet, this screen never navigates away, so once the sheet closes
  // (or the app resumes) a payment made from here needs an explicit check
  // too — this card never had one before since the old external-browser
  // flow happened to get it for free via appStateChange.
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
          setShowPayment(false);
          setShowConfirmSummary(false);
          setSubmittingPayment(false);
          await refetchDinners();
          return;
        }
      } catch { /* treated as "not confirmed yet" below */ }
      if (attempts < 3) {
        setTimeout(checkPendingPayment, 2500);
      } else {
        sessionStorage.removeItem('heyder_pending_session_id');
        setSubmittingPayment(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') { attempts = 0; checkPendingPayment(); }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('heyder:checkoutClosed', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('heyder:checkoutClosed', onVisible);
    };
  }, []);
  const handleConfirmClick = () => {
    if (!bookingDate) { toast.error('Choose a date first.'); return; }
    const seed = Math.random().toString(36).slice(2);
    setMatchAvatars(Array.from({ length: 5 }, (_, i) => `https://i.pravatar.cc/150?u=${seed}-${i}`));
    setShowConfirmSummary(true);
  };

  // The card's third and final stage — morphs into the plan choice in
  // place instead of navigating to a separate page, same reasoning as the
  // sentence→summary morph above. Only the profile data actually needed to
  // submit a booking is fetched here (lazily, on "Continue to book"), not
  // up front, since most visits never get this far.
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAnswers, setPaymentAnswers] = useState(null);
  const [pricing, setPricing] = useState({ oneTimeAmount: 1000, subscriptionAmount: 1500 });
  const [selectedPlan, setSelectedPlan] = useState('one_time');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true); setCouponError('');
    try {
      const res = await api.post('/payments/validate-coupon', { code: couponInput.trim(), plan: selectedPlan });
      setAppliedCoupon({ code: res.data.code, discountPercent: res.data.discountPercent });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.response?.data?.error || 'That code is invalid or has expired.');
    } finally { setValidatingCoupon(false); }
  };
  const removeCoupon = () => { setAppliedCoupon(null); setCouponInput(''); setCouponError(''); };
  const stripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const bookingDateField = bookingDate
    ? bookingDate.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

  const [continuingToBook, setContinuingToBook] = useState(false);
  const handleContinueToBookClick = async () => {
    if (continuingToBook) return;
    setContinuingToBook(true);
    try {
      const [profileRes, pricingRes] = await Promise.all([
        api.get('/portal/full-profile'),
        api.get('/payments/pricing').catch(() => null),
      ]);
      const { locked, photo, answers: savedAnswers } = profileRes.data;
      setPaymentAnswers({
        first_name: locked.first_name,
        last_name: locked.last_name,
        phone: locked.phone,
        dob: locked.dob,
        gender: locked.gender,
        country: locked.country,
        photo: photo || undefined,
        ...savedAnswers,
      });
      if (pricingRes) setPricing(pricingRes.data);
      setShowPayment(true);
    } catch {
      // Fixed id so a user who taps "Continue" again after a flaky
      // connection sees the same toast refresh, instead of a new one
      // stacking on top of the last one still on screen.
      toast.error('Could not load your profile. Please try again.', { id: 'continue-to-book-error' });
    } finally {
      setContinuingToBook(false);
    }
  };

  // A 409 here means a booking of ours already exists (most likely made by
  // an earlier tap of this same button that the UI hadn't caught up to
  // yet) — retrying it would only 409 again and, enough times, trip the
  // /profile/submit rate limit. Refetching + backing out of the payment
  // flow instead swaps this screen over to that real booking's DinnerCard,
  // which is the state the account is actually in.
  const submitBookingInline = async (plan) => {
    try {
      await api.post('/profile/submit', {
        ...paymentAnswers,
        field_CdZldwp5q09o: bookingDateField,
        field_OVB7lzEjSl7C: paymentAnswers.field_OVB7lzEjSl7C || [],
        plan,
      });
      navigate('/profile/success', { state: { date: bookingDateField, city: bookingCity, plan } });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.', { id: 'booking-submit-error' });
      setSubmittingPayment(false);
      if (err.response?.status === 409) {
        setShowPayment(false);
        setShowConfirmSummary(false);
        refetchDinners().catch(() => {});
      }
    }
  };

  const handleConfirmSubscribedInline = async () => {
    if (submittingPayment) return;
    setSubmittingPayment(true);
    await submitBookingInline(undefined);
  };

  const handlePayInline = async () => {
    if (!paymentAnswers || submittingPayment) return;
    setSubmittingPayment(true);
    const fullAnswers = { ...paymentAnswers, field_CdZldwp5q09o: bookingDateField };
    try {
      if (!stripeConfigured) {
        await submitBookingInline(selectedPlan);
        return;
      }
      await api.post('/profile/submit', {
        ...fullAnswers,
        field_OVB7lzEjSl7C: fullAnswers.field_OVB7lzEjSl7C || [],
        awaitingPayment: true,
      });
      const res = await api.post('/payments/create-checkout', {
        email: attendeeUser?.email,
        plan: selectedPlan,
        couponCode: appliedCoupon?.code,
      });
      sessionStorage.setItem('heyder_quiz_answers', JSON.stringify(fullAnswers));
      sessionStorage.setItem('heyder_pending_session_id', res.data.sessionId);
      openCheckout(res.data.url);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment setup failed. Please try again.', { id: 'payment-setup-error' });
      setSubmittingPayment(false);
      if (err.response?.status === 409) {
        setShowPayment(false);
        setShowConfirmSummary(false);
        refetchDinners().catch(() => {});
      }
    }
  };
  // Persisted per-session — without this, leaving the tab (Album, Chat, etc.)
  // and coming back unmounts/remounts this component, resetting this to
  // false and replaying the full typing animation every single visit.

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

  const { data: dinnersData, loading: dinnersLoading, setData: setDinnersData, refetch: refetchDinners } = useCachedFetch(
    'portal_dinners',
    async () => (await api.get('/portal/dinners')).data.dinners || []
  );

  const loading = profileLoading || dinnersLoading;
  const showIntro = loading;
  const loadError = profileLoadError;
  // Starts once loading has finished and the real content has mounted (at
  // opacity 0), not at first mount — otherwise a slow load would mount it
  // already revealed and it would just pop in. The short timeout lets the
  // browser paint opacity:0 first so the fade actually runs.
  useEffect(() => {
    if (!justCompletedProfile || showIntro) return;
    const t = setTimeout(() => setDashboardRevealed(true), 150);
    return () => clearTimeout(t);
  }, [justCompletedProfile, showIntro]);
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
  // Mirrors the needsProfile screen's exact chrome below (nav height,
  // eyebrow spacing, pl-2, text-3xl Permanent Marker) so the intro text
  // sits in the identical spot the "Location" heading occupies next. After
  // erasing, it types "Location" itself into that same spot, then hands
  // off immediately (no fade of its own) — the real screen's other
  // elements fade in around that already-visible word instead.
  // Arriving from the completion video, the map is already on screen — keep
  // it there while loading (no spinner, no plain cream) so there's no gap.
  if (showIntro && justCompletedProfile) return <div className="portal-bg quiz-handoff min-h-screen" />;

  if (showIntro) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#E7DFC5' }}>
      <div className="w-7 h-7 border-2 border-plum border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (loadError) return (
    <div className="portal-bg min-h-screen flex items-center justify-center p-8 text-center">
      <div>
        <p className="font-serif text-2xl text-navy mb-3">Couldn't load your dashboard</p>
        <p className="font-sans text-navy/65 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
        <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
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
      <motion.nav
        {...revealFade}
        className="relative z-10 flex items-center justify-between px-6 pb-5 border-b border-navy/10"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <Link to="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        </Link>
        <button onClick={async () => { await logout(); navigate('/'); }} className="font-sans text-navy/50 text-xs hover:text-navy transition-colors">
          Sign out
        </button>
      </motion.nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 space-y-8">
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
    <div
      className={`portal-bg min-h-screen relative overflow-hidden pb-nav ${justCompletedProfile ? 'quiz-handoff' : ''}`}
    >
      <div>
      {/* Nav */}
      <nav
        className="relative z-10 flex items-center justify-between px-6 pb-5"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))', ...handoffReveal(0) }}
      >
        <Link to="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        </Link>
        <div className="flex items-center gap-3">
          {past.length > 0 && (
            <button
              onClick={() => setShowPastDinners(true)}
              aria-label="Past dinners"
              className="relative w-9 h-9 rounded-full border border-navy/20 text-navy/65 hover:text-navy hover:border-navy/40 flex items-center justify-center transition-colors"
            >
              <Clock size={17} strokeWidth={1.75} />
            </button>
          )}
          <Link to="/portal/profile" aria-label="Your profile" className="block w-9 h-9 rounded-full overflow-hidden border border-navy/25">
            <img src={profile?.photo || AVATAR} alt="" className="w-full h-full object-cover" draggable={false} />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6" style={handoffReveal(2200)}>

        {/* Upcoming dinners */}
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map(d => (
              <DinnerCard key={d.table_id} dinner={d} onCancel={cancelBooking} onRsvpUpdate={updateRsvpCache} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-6" style={{ /* 174px = measured header + paddings; the bottom spacing (the floating nav's pb-nav) and the notch inset are subtracted too, or the page is taller than the screen and scrolls */ minHeight: 'calc(100dvh - 174px - (var(--nav-top) + 28px) - env(safe-area-inset-top))' }}>
            <div className="flex flex-col items-center gap-6">
              <motion.div
                layout
                layoutDependency={`${showConfirmSummary}-${showPayment}`}
                transition={{ layout: { duration: 0.45, ease: [0.32, 0.72, 0, 1] } }}
                className={`relative rounded-2xl text-center ${showConfirmSummary ? 'px-7 py-6' : 'px-5 py-6'}`}
                style={{
                  background: 'rgba(245,237,216,0.85)',
                  border: '1px solid rgba(22,24,29,0.15)',
                  boxShadow: '0 20px 44px rgba(22,24,29,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
                  width: showConfirmSummary ? 'min(360px, 88vw)' : 'min(440px, 92vw)',
                  overflow: showConfirmSummary ? 'hidden' : 'visible',
                }}
              >
                {showConfirmSummary && (
                  <button
                    type="button"
                    onClick={() => { setShowConfirmSummary(false); setShowPayment(false); }}
                    aria-label="Close"
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-navy/70 hover:text-navy transition-colors"
                    style={{ background: 'rgba(22,24,29,0.08)', zIndex: 10 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                  {!showConfirmSummary ? (
                    <motion.div
                      key="sentence"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      {/* Fixed two-line break (not left to natural wrap) — the
                          available width still varies phone to phone, and
                          wrapping on its own put a third line in on some
                          screens and two on others. Breaking here always,
                          and letting the size shrink a touch on narrow
                          phones instead, keeps the same two-line shape
                          everywhere. */}
                      <p className="font-serif font-bold text-navy leading-relaxed" style={{ fontSize: 'clamp(1.1rem, 5.4vw, 1.7rem)' }}>
                        <span style={{ whiteSpace: 'nowrap' }}>Book my dinner on <InlineDatePill value={bookingDate} onChange={setBookingDate} /></span>
                        <br />
                        <span style={{ whiteSpace: 'nowrap' }}>in <InlineCityPill value={bookingCity} onChange={setBookingCity} /> city.</span>
                      </p>
                    </motion.div>
                  ) : !showPayment ? (
                    <motion.div
                      key="summary"
                      className="relative"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <p className="font-serif font-bold text-navy leading-snug pr-6" style={{ fontSize: '1.5rem' }}>
                        Dinner + Afterparty
                        <br />
                        {bookingDate ? formatTuesdayOption(bookingDate) : ''}
                      </p>

                      <p className="font-sans text-navy/60 text-sm mt-3 mb-4">with 5 compatible matches</p>
                      <div className="flex justify-center -space-x-3 mb-7">
                        {matchAvatars.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                            style={{ border: '2px solid #F5EDD8', filter: 'blur(4px)' }}
                          />
                        ))}
                      </div>

                      <div className="text-left space-y-4 mb-7">
                        {[
                          'Group glimpse and group chat opens 48 hrs before',
                          'Venue & afterparty activity revealed 24 hrs before',
                          `Dinner on ${bookingDate ? formatTuesdayOption(bookingDate) : ''} 7pm followed by the afterparty`,
                        ].map((step, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span
                              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-sans text-xs font-bold"
                              style={{ background: '#754471', color: '#F5EDD8' }}
                            >
                              {i + 1}
                            </span>
                            <p className="font-sans text-sm text-navy/80 leading-snug pt-0.5">{step}</p>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleContinueToBookClick}
                        disabled={continuingToBook}
                        className="inline-flex items-center justify-center gap-2 font-sans font-semibold text-sm tracking-widest uppercase px-6 py-3 rounded-2xl transition-all duration-200 w-full disabled:opacity-60"
                        style={{ background: '#754471', color: '#F5EDD8' }}
                      >
                        {continuingToBook ? 'Loading…' : 'Continue to book'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="payment"
                      className="relative"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <p className="font-serif font-bold text-navy leading-snug pr-6" style={{ fontSize: '1.5rem' }}>
                        Choose your plan
                      </p>

                      {hasActiveSubscription ? (
                        <div className="mt-5">
                          <p className="font-sans text-sm text-navy/60 mb-4">Included in your membership.</p>
                          <button
                            type="button"
                            onClick={handleConfirmSubscribedInline}
                            disabled={submittingPayment}
                            className="w-full inline-flex items-center justify-center gap-2 font-sans font-semibold text-sm tracking-widest uppercase px-6 py-3 rounded-2xl transition-all duration-200 disabled:opacity-60"
                            style={{ background: '#754471', color: '#F5EDD8' }}
                          >
                            {submittingPayment ? 'Confirming…' : 'Confirm booking'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 my-5 text-left">
                            <button
                              type="button"
                              onClick={() => { setSelectedPlan('one_time'); if (appliedCoupon) removeCoupon(); }}
                              className="portal-login-input w-full text-left block transition-all duration-200"
                              style={selectedPlan === 'one_time' ? { borderColor: '#16181d', background: 'rgba(255,255,255,0.5)' } : undefined}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-sans font-semibold text-sm text-navy">One-time</span>
                                <span className="font-serif text-xl text-navy">${(pricing.oneTimeAmount / 100).toFixed(2).replace(/\.00$/, '')}</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => { setSelectedPlan('subscription'); if (appliedCoupon) removeCoupon(); }}
                              className="portal-login-input w-full text-left block relative transition-all duration-200"
                              style={selectedPlan === 'subscription' ? { borderColor: '#16181d', background: 'rgba(255,255,255,0.5)' } : undefined}
                            >
                              <span className="absolute -top-2.5 right-4 bg-navy text-cream text-[9px] font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">Best value</span>
                              <div className="flex items-center justify-between">
                                <span className="font-sans font-semibold text-sm text-navy">Monthly</span>
                                <span className="font-serif text-xl text-navy">${(pricing.subscriptionAmount / 100).toFixed(2).replace(/\.00$/, '')}<span className="text-xs">/mo</span></span>
                              </div>
                            </button>
                          </div>
                          {appliedCoupon ? (
                            <div className="flex items-center justify-between mb-3 font-sans text-sm text-navy/70">
                              <span>✓ Code <span className="font-mono">{appliedCoupon.code}</span> — {appliedCoupon.discountPercent}% off</span>
                              <button type="button" onClick={removeCoupon} className="text-navy/50 hover:text-navy text-xs">Remove</button>
                            </div>
                          ) : showCoupon ? (
                            <div className="mb-3">
                              <div className="flex gap-2">
                                <input
                                  className="portal-login-input !py-2.5 flex-1 uppercase"
                                  placeholder="Coupon code"
                                  value={couponInput}
                                  onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                                  autoFocus
                                />
                                <button type="button" onClick={applyCoupon} disabled={validatingCoupon || !couponInput.trim()} className="px-4 rounded-2xl font-sans text-sm font-semibold disabled:opacity-50" style={{ background: '#754471', color: '#F5EDD8' }}>
                                  {validatingCoupon ? '…' : 'Apply'}
                                </button>
                              </div>
                              {couponError && <p className="font-sans text-red-600 text-xs mt-1.5 text-left">{couponError}</p>}
                            </div>
                          ) : (
                            <button type="button" onClick={() => setShowCoupon(true)} className="block mx-auto mb-3 font-sans text-xs text-navy/55 underline underline-offset-2">Have a coupon code?</button>
                          )}
                          <button
                            type="button"
                            onClick={handlePayInline}
                            disabled={submittingPayment}
                            className="w-full inline-flex items-center justify-center gap-2 font-sans font-semibold text-sm tracking-widest uppercase px-6 py-3 rounded-2xl transition-all duration-200 disabled:opacity-60"
                            style={{ background: '#754471', color: '#F5EDD8' }}
                          >
                            {submittingPayment ? 'Processing…' : !stripeConfigured ? 'Confirm (test mode)' : 'Pay & confirm'}
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              {!showConfirmSummary && (
                <button
                  type="button"
                  onClick={handleConfirmClick}
                  className="inline-flex items-center justify-center gap-2 border-2 font-sans font-semibold text-sm tracking-widest uppercase px-6 py-3 rounded-2xl backdrop-blur-md transition-all duration-300"
                  // Turns solid purple as soon as both the date and the city are chosen.
                  style={bookingDate && bookingCity
                    ? { borderColor: '#754471', color: '#F5EDD8', background: '#754471', boxShadow: '0 8px 24px rgba(117,68,113,0.35)' }
                    : { borderColor: '#754471', color: '#754471', background: 'rgba(231,223,197,0.35)' }}
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Past dinners — opened from the clock button up in the nav rather
          than living inline, so a long history doesn't push the booking
          card down the page. Animated (not just mounted/unmounted) so it
          reads as sliding up from behind the bottom nav, and eases back
          down the same way on close. */}
      <AnimatePresence>
        {showPastDinners && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowPastDinners(false)}
          >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            className="w-full max-w-lg bg-cream rounded-t-3xl max-h-[75vh] overflow-y-auto p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-serif font-bold text-xl text-navy">Past dinners</p>
              <button onClick={() => setShowPastDinners(false)} className="font-sans text-navy/55 hover:text-navy text-xs transition-colors">Close</button>
            </div>
            <div className="space-y-2">
              {[...past].sort((a, b) => new Date(b.date) - new Date(a.date)).map(d => (
                <div key={d.table_id} className="rounded-xl border border-navy/10 px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.4)' }}>
                  <div>
                    <p className="font-sans text-navy/72 text-sm">
                      {new Date(d.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' })}
                    </p>
                    {d.restaurant_name && <p className="font-sans text-navy/50 text-xs mt-0.5">{d.restaurant_name}</p>}
                  </div>
                  {d.has_feedback ? (
                    <span className="font-sans text-emerald-700/80 text-xs">✓ Rated</span>
                  ) : (
                    <Link
                      to={`/feedback/${d.dinner_id}?uid=${attendeeUser?.uid}`}
                      className="font-sans text-plum text-xs hover:text-plum transition-colors"
                    >
                      Rate →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setShowContactModal(false)}>
          <div className="glass-card w-full max-w-sm space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <p className="font-serif text-xl text-navy">Too close to cancel</p>
            <p className="font-sans text-navy/72 text-sm leading-relaxed">
              Cancellations within 24 hours of dinner can't be self-served — the table's already been booked. Email us and we'll sort it out.
            </p>
            <a
              href="mailto:info@heyder.nz"
              className="plum-cta w-full flex items-center justify-center"
            >
              info@heyder.nz
            </a>
            <button
              onClick={() => setShowContactModal(false)}
              className="font-sans text-navy/55 hover:text-navy text-xs transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div style={handoffReveal(4400)}>
        <BottomNav />
      </div>
      </div>
    </div>
  );
}
