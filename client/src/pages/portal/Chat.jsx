import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { flagUrl } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

// One compact row per person — small enough that a table full of
// tablemates doesn't turn into a wall of oversized cards.
function PersonRow({ person, onOpen, onConnect, onDismiss, onAccept, onDecline, busy }) {
  const isNone = person.status === 'none';
  return (
    <div
      onClick={person.status === 'connected' ? onOpen : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] ${
        person.status === 'connected' ? 'cursor-pointer hover:border-gold/30' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <img src={person.photo || AVATAR_FALLBACK} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
        {person.has_unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#16181d]" />
        )}
      </div>
      <p className={`font-sans text-cream text-sm font-medium flex items-center gap-1.5 truncate min-w-0 ${isNone ? 'flex-shrink' : 'flex-1'} ${person.has_unread ? 'font-semibold' : ''}`}>
        {person.first_name || 'Guest'}
        {person.country && flagUrl(person.country) && (
          <img src={flagUrl(person.country)} alt={person.country} className="h-2.5 rounded-[1px] flex-shrink-0" />
        )}
        {person.has_unread && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        )}
      </p>

      {/* Connect sits right next to the name; ✕ (not interested) is pushed
          to the far right by the spacer below — kept apart on purpose so
          the two aren't adjacent and easy to fat-finger by mistake. */}
      {isNone && (
        <button
          onClick={(e) => { e.stopPropagation(); onConnect(person); }}
          disabled={busy}
          className="quiz-cta text-[10px] py-1 px-2.5 flex-shrink-0"
        >
          Connect
        </button>
      )}

      {isNone && <div className="flex-1" />}

      {person.status === 'connected' && <span className="text-cream/20 flex-shrink-0 ml-auto">→</span>}

      {person.status === 'pending_outgoing' && (
        <span className="font-sans text-cream/30 text-[11px] flex-shrink-0 ml-auto">Pending</span>
      )}

      {person.status === 'pending_incoming' && (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(person); }}
            disabled={busy}
            className="quiz-cta text-[10px] py-1 px-2.5 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDecline(person); }}
            disabled={busy}
            className="font-sans text-cream/30 hover:text-red-400 text-[10px] transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {isNone && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(person); }}
          disabled={busy}
          className="w-6 h-6 rounded-full border border-white/10 text-cream/30 hover:text-cream/70 hover:border-white/25 flex items-center justify-center text-xs transition-colors disabled:opacity-50 flex-shrink-0"
          title="Not interested"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const [people, setPeople] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchData = () => api.get('/connections')
    .then(res => { setPeople(res.data.people || []); setLoadError(false); })
    .catch(() => setLoadError(true));

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try { await fn(); await fetchData(); }
    catch (err) { toast.error(err.response?.data?.error || 'Something went wrong.'); }
    finally { setBusyId(null); }
  };

  const handleConnect = (person) => withBusy(person.user_id, async () => {
    await api.post('/connections/request', { toUserId: person.user_id });
    toast.success('Connect request sent!');
  });
  const handleDismiss = (person) => withBusy(person.user_id, () => api.post(`/connections/${person.user_id}/dismiss`));
  const handleAccept = (person) => withBusy(person.user_id, async () => {
    await api.post(`/connections/requests/${person.request_id}/accept`);
    toast.success('Connected!');
  });
  const handleDecline = (person) => withBusy(person.user_id, () => api.post(`/connections/requests/${person.request_id}/decline`));

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-2.5 animate-pulse">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex-shrink-0" />
              <div className="h-3.5 flex-1 rounded bg-white/[0.06]" style={{ maxWidth: `${60 - i * 6}%` }} />
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loadError && !people) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Couldn't load your connections</p>
          <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
          <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-3">
        <div className="mb-5">
          <p className="font-sans text-cream/40 text-sm">Your people</p>
          <h1 className="font-serif text-3xl text-cream mt-1">Connections</h1>
          <p className="font-sans text-cream/40 text-sm mt-2 leading-relaxed">
            Everyone you've shared a revealed dinner with. Connect to message directly, or ✕ if not.
          </p>
        </div>

        {people.length === 0 && (
          <div className="quiz-card text-center py-10">
            <p className="font-sans text-cream/50 text-sm">
              No one here yet — this fills up once a dinner's group is fully revealed.
            </p>
          </div>
        )}

        {people.map(p => (
          <PersonRow
            key={p.user_id}
            person={p}
            busy={busyId === p.user_id}
            onOpen={() => navigate(`/portal/dm/${p.connection_id}`)}
            onConnect={handleConnect}
            onDismiss={handleDismiss}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
