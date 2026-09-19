import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { flagUrl } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { Stagger, Rise } from '../../components/Motion';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

// One compact row per person — small enough that a table full of
// tablemates doesn't turn into a wall of oversized cards.
function PersonRow({ person, onOpen, onConnect, onDismiss, onAccept, onDecline, busy }) {
  const isNone = person.status === 'none';
  return (
    <div
      onClick={person.status === 'connected' ? onOpen : undefined}
      className={`flex items-center gap-3 glass-card !px-3 !py-2.5 ${
        person.status === 'connected' ? 'cursor-pointer hover:border-plum/30' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <img src={person.photo || AVATAR_FALLBACK} alt="" className="w-12 h-12 rounded-full object-cover border border-navy/15" />
      </div>
      <p className={`font-sans text-navy text-sm font-medium flex items-center gap-1.5 truncate min-w-0 ${isNone ? 'flex-shrink' : 'flex-1'} ${person.has_unread ? 'font-semibold' : ''}`}>
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
          className="plum-cta text-[10px] py-1 px-2.5 flex-shrink-0"
        >
          Connect
        </button>
      )}

      {isNone && <div className="flex-1" />}

      {person.status === 'connected' && <span className="text-navy/35 flex-shrink-0 ml-auto">→</span>}

      {person.status === 'pending_outgoing' && (
        <span className="font-sans text-navy/45 text-[11px] flex-shrink-0 ml-auto">Pending</span>
      )}

      {person.status === 'pending_incoming' && (
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(person); }}
            disabled={busy}
            className="plum-cta text-[10px] py-1 px-2.5 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDecline(person); }}
            disabled={busy}
            className="font-sans text-navy/45 hover:text-red-700 text-[10px] transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {isNone && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(person); }}
          disabled={busy}
          className="w-6 h-6 rounded-full border border-navy/15 text-navy/45 hover:text-navy/80 hover:border-navy/30 flex items-center justify-center text-xs transition-colors disabled:opacity-50 flex-shrink-0"
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
  const [busyId, setBusyId] = useState(null);
  const { data: people, loading, error: loadError, refetch } = useCachedFetch(
    'portal_connections',
    async () => (await api.get('/connections')).data.people || []
  );

  const withBusy = async (id, fn) => {
    setBusyId(id);
    try { await fn(); await refetch({ silent: true }); }
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
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 backdrop-blur-md">
      <Link to="/portal/dashboard" className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-3">
          <h1 className="font-serif font-bold text-3xl text-navy mb-5">Connections</h1>
          <div className="space-y-2.5 animate-pulse">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 glass-card !px-3 !py-2.5">
                <div className="w-12 h-12 rounded-full bg-white/40 flex-shrink-0" />
                <div className="h-3.5 flex-1 rounded bg-white/40" style={{ maxWidth: `${60 - i * 6}%` }} />
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loadError && !people) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="portal-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <Stagger className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-3">
        <Rise><h1 className="font-serif font-bold text-3xl text-navy mb-2">Connections</h1></Rise>

        {people.length === 0 && (
          <Rise className="glass-card text-center py-10">
            <p className="font-sans text-navy/65 text-sm">No one yet.</p>
          </Rise>
        )}

        {people.map(p => (
          <Rise key={p.user_id}>
            <PersonRow
              person={p}
              busy={busyId === p.user_id}
              onOpen={() => navigate(`/portal/dm/${p.connection_id}`)}
              onConnect={handleConnect}
              onDismiss={handleDismiss}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          </Rise>
        ))}
      </Stagger>
      <BottomNav />
    </div>
  );
}
