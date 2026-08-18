import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { flagUrl } from '../../utils/flags';
import BottomNav from '../../components/BottomNav';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

function PersonRow({ user, right, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 quiz-card ${onClick ? 'cursor-pointer hover:border-gold/30' : ''}`}
    >
      <img src={user.photo || AVATAR_FALLBACK} alt="" className="w-12 h-12 rounded-full object-cover border border-white/10 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-sans text-cream text-sm font-semibold flex items-center gap-1.5 truncate">
          {user.first_name || 'Guest'}
          {user.country && flagUrl(user.country) && (
            <img src={flagUrl(user.country)} alt={user.country} className="h-3 rounded-[2px] flex-shrink-0" />
          )}
        </p>
      </div>
      {right}
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchData = () => api.get('/connections')
    .then(res => { setData(res.data); setLoadError(false); })
    .catch(() => setLoadError(true));

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const respond = async (requestId, action) => {
    setBusyId(requestId);
    try {
      await api.post(`/connections/requests/${requestId}/${action}`);
      toast.success(action === 'accept' ? 'Connected!' : 'Request declined.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not respond to that request.');
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-10" />
    </nav>
  );

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError && !data) {
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

  const { connections = [], incoming_requests = [], outgoing_requests = [] } = data || {};
  const isEmpty = !connections.length && !incoming_requests.length && !outgoing_requests.length;

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="font-sans text-cream/40 text-sm">Your people</p>
          <h1 className="font-serif text-3xl text-cream mt-1">Connections</h1>
          <p className="font-sans text-cream/40 text-sm mt-2 leading-relaxed">
            Click anyone's name in a past group chat to view their profile and connect — once you both agree, you can message directly.
          </p>
        </div>

        {isEmpty && (
          <div className="quiz-card text-center py-10">
            <p className="font-sans text-cream/50 text-sm">
              No connections yet. After a dinner, tap someone's name in the group chat to send a connect request.
            </p>
          </div>
        )}

        {incoming_requests.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">Requests</p>
            {incoming_requests.map(r => (
              <PersonRow
                key={r.request_id}
                user={r}
                right={
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => respond(r.request_id, 'accept')}
                      disabled={busyId === r.request_id}
                      className="quiz-cta text-[11px] py-1.5 px-3 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(r.request_id, 'decline')}
                      disabled={busyId === r.request_id}
                      className="font-sans text-cream/30 hover:text-red-400 text-[11px] transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}

        {connections.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">Messages</p>
            {connections.map(c => (
              <PersonRow
                key={c.connection_id}
                user={c}
                onClick={() => navigate(`/portal/dm/${c.connection_id}`)}
                right={<span className="text-cream/20 flex-shrink-0">→</span>}
              />
            ))}
          </div>
        )}

        {outgoing_requests.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">Sent</p>
            {outgoing_requests.map(r => (
              <PersonRow
                key={r.request_id}
                user={r}
                right={<span className="font-sans text-cream/30 text-[11px] flex-shrink-0">Pending</span>}
              />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
