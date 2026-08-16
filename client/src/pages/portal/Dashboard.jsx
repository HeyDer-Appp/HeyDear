import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BottomNav from '../../components/BottomNav';
import { flagEmoji } from '../../utils/flags';

const AVATAR = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

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
    label: 'Venue revealed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    icon: '✓',
    description: "Everything is locked in. See you tonight at 7pm.",
  },
};

// A tablemate's career answer, with their name and photo both masked until
// the 8pm reveal — only the job-for-a-kid answer is visible from the start.
function GlimpseCard({ member, revealed }) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
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
        <p className="font-sans text-cream/60 text-xs font-semibold mb-0.5">
          {revealed ? (member.first_name || 'Guest') : '•••'} {member.country && flagEmoji(member.country)}
        </p>
        <p className="font-sans text-cream/40 text-[10px] uppercase tracking-widest mb-0.5">Describes their job as</p>
        <p className="font-sans text-cream text-sm italic">
          "{member.career_kid || 'No answer shared'}"
        </p>
      </div>
    </div>
  );
}

// The group-info popup — everyone else at the table, name and photo both
// blurred/masked until 8pm dinner night, with a way straight into the group
// chat where the icebreakers are already waiting.
function GlimpseModal({ tableId, onClose }) {
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

function DinnerCard({ dinner, onCancel }) {
  const [now, setNow] = useState(() => new Date());
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

  return (
    <div className={`quiz-card ${config.border}`}>
      {/* Status badge */}
      <div className="flex items-center justify-between mb-5">
        <span className={`inline-flex items-center gap-2 text-xs font-sans font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full whitespace-nowrap ${config.bg} ${config.color}`}>
          <span>{config.icon}</span><span>{config.label}</span>
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
          { icon: '📍', step: 'Venue revealed', secsLeft: venueSecsLeft, unlocked: venueSecsLeft !== null && venueSecsLeft <= 0, notStarted: !groupUnlocked },
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

      {/* Cancel */}
      {!isPast && (
        <button
          onClick={() => onCancel(dinner.table_id)}
          className="mt-5 text-cream/25 hover:text-red-400 font-sans text-xs transition-colors"
        >
          Cancel booking
        </button>
      )}
    </div>
  );
}

export default function PortalDashboard() {
  const { attendeeUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [dinners, setDinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [location, setLocation] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/portal/profile'),
      api.get('/portal/dinners'),
    ]).then(([p, d]) => {
      setProfile(p.data.user);
      setDinners(d.data.dinners || []);
    }).catch((err) => {
      // A brand-new account (or one that hasn't finished onboarding) has no
      // Firestore profile doc yet — that's a normal state, not a failure.
      if (err.response?.status === 404) {
        setNeedsProfile(true);
      } else {
        console.error(err);
        setLoadError(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const cancelBooking = async (tableId) => {
    if (!confirm('Cancel this booking? Refunds take 2-3 working days.')) return;
    try {
      const res = await api.post(`/portal/cancel/${tableId}`);
      toast.success(res.data.message);
      setDinners(prev => prev.filter(d => d.table_id !== tableId));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancellations must be made 48 hours before dinner.');
    }
  };

  if (loading) return (
    <div className="quiz-bg min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
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

  if (needsProfile || (profile && !profile.profileComplete)) return (
    <div className="quiz-bg min-h-screen relative overflow-hidden">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/">
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        </Link>
        <button onClick={() => { logout(); navigate('/'); }} className="font-sans text-cream/40 text-xs hover:text-cream transition-colors">
          Sign out
        </button>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 space-y-8">
        <div className="text-center">
          <p className="font-sans text-gold/70 text-xs tracking-[0.2em] uppercase mb-3">Welcome to HeyDer</p>
        </div>

        <div className="quiz-card space-y-3">
          <label className="font-sans text-cream/70 text-sm font-medium block">Location</label>
          <select
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream font-sans text-sm focus:outline-none focus:border-gold/50"
          >
            <option value="" disabled className="bg-navy text-cream/40">Select your city</option>
            {['Auckland', 'Wellington', 'Sydney', 'Melbourne', 'Brisbane'].map(city => (
              <option key={city} value={city} className="bg-navy text-cream">{city}</option>
            ))}
          </select>
        </div>

        {location && location !== 'Auckland' && (
          <div className="quiz-card text-center">
            <p className="font-sans text-cream/50 text-sm leading-relaxed">
              We're currently curating dinners only in Auckland. We'll let you know when we expand to {location}.
            </p>
          </div>
        )}

        <Link
          to="/profile"
          onClick={e => { if (location !== 'Auckland') e.preventDefault(); }}
          className={`quiz-cta w-full flex items-center justify-center text-base py-4 ${location !== 'Auckland' ? 'opacity-40 pointer-events-none' : ''}`}
        >
          Build My Profile →
        </Link>

        <div className="quiz-card space-y-5">
          <p className="font-sans font-semibold text-cream text-sm">How HeyDer works</p>
          {[
            ['①', 'Build your profile', 'A few quick questions about you and who you want to meet.'],
            ['②', 'Book your spot', 'Reserve your seat at this week\'s dinner.'],
            ['③', "We'll find your group", 'A curated table of people who wanted to meet someone like you.'],
            ['④', 'Just show up', 'Every Tuesday, 7pm, Auckland. Food & drinks paid at the venue.'],
          ].map(([num, title, body]) => (
            <div key={title} className="flex items-start gap-3">
              <span className="font-serif text-gold text-lg leading-none mt-0.5">{num}</span>
              <div>
                <p className="font-sans text-cream text-sm font-medium">{title}</p>
                <p className="font-sans text-cream/45 text-xs mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="font-sans text-cream/25 text-xs text-center">
          Questions? <a href="mailto:info@heyder.nz" className="text-gold/60 hover:text-gold transition-colors">info@heyder.nz</a>
        </p>
      </div>
    </div>
  );

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
          <button onClick={() => { logout(); navigate('/'); }} className="font-sans text-cream/40 text-xs hover:text-cream transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-6">

        {/* Greeting */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-cream/40 text-sm">Welcome back</p>
            <h1 className="font-serif text-4xl text-cream mt-1">
              {profile?.first_name} {profile?.last_name?.charAt(0)}.
            </h1>
          </div>
          <Link
            to="/portal/profile"
            className="font-sans text-gold text-xs hover:text-yellow transition-colors whitespace-nowrap mt-2"
          >
            Edit profile →
          </Link>
        </div>

        {/* Upcoming dinners */}
        {upcoming.length > 0 ? (
          <div className="space-y-4">
            {upcoming.map(d => (
              <DinnerCard key={d.table_id} dinner={d} onCancel={cancelBooking} />
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

      <BottomNav />
    </div>
  );
}
