import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { success as hapticSuccess } from '../../utils/haptics';
import ReportUserModal from '../../components/ReportUserModal';
import { usePolling } from '../../utils/usePolling';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

export default function DirectChat() {
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const { attendeeUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const feedRef = useRef(null);

  const fetchThread = () => api.get(`/connections/${connectionId}/messages`)
    .then(res => { setData(res.data); setLoadError(false); })
    .catch(() => setLoadError(true));

  useEffect(() => {
    setLoading(true);
    fetchThread().finally(() => setLoading(false));
  }, [connectionId]);

  // Shares the site-wide API rate limit and the database's daily quota with every
  // other request, so it only polls while the app is actually on screen.
  usePolling(fetchThread, 10000);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [data?.messages?.length]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/connections/${connectionId}/messages`, { text: value });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
      setText('');
      hapticSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const header = (
    <nav
      className="relative z-10 flex items-center justify-between px-6 pb-5"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <button onClick={() => navigate('/portal/chat')} className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← All chats</button>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
      <div className="w-16" />
    </nav>
  );

  if (loading) {
    return (
      <div className="portal-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="portal-bg min-h-screen relative overflow-hidden">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
      </div>
    );
  }

  const other = data?.other || {};

  return (
    <div className="portal-bg min-h-screen relative overflow-hidden">
      {header}

      <div className="relative z-10 flex items-center justify-between max-w-lg mx-auto px-5 pt-5 pb-3">
        <Link to={`/portal/person/${other.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={other.photo || AVATAR_FALLBACK} alt="" className="w-10 h-10 rounded-full object-cover border border-navy/15" />
          <p className="font-sans text-navy font-semibold text-sm">{other.first_name || 'Guest'}</p>
        </Link>
        <button onClick={() => setShowReport(true)} className="font-sans text-navy/40 hover:text-red-700 text-xs transition-colors flex-shrink-0">
          Report
        </button>
      </div>

      <div ref={feedRef} className="relative z-10 max-w-lg mx-auto px-5 pb-40 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {(data.messages || []).length === 0 && (
          <div className="glass-card text-center py-10 my-4">
            <p className="font-sans text-navy/55 text-sm">👋</p>
          </div>
        )}
        {(data.messages || []).map(msg => {
          const isOwn = msg.from_user_id === attendeeUser?.uid;
          return (
            <div key={msg.id} className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 font-sans text-sm shadow-[0_4px_12px_rgba(22,24,29,0.08)] ${
                  isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-cream/90 text-navy rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-beige/70 backdrop-blur-md px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Message"
            className="flex-1 bg-white/40 border border-navy/15 rounded-full px-4 py-2.5 text-navy text-sm font-sans focus:outline-none focus:border-plum/40"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="plum-cta text-xs py-2.5 px-4 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>

      {showReport && (
        <ReportUserModal userId={other.user_id} userName={other.first_name} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
