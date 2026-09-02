import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import ReportUserModal from '../../components/ReportUserModal';

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
    // Shares the site-wide API rate limit with every other request on this
    // connection, so this has to stay well under budget for a tab left open.
    const poll = setInterval(fetchThread, 10000);
    return () => clearInterval(poll);
  }, [connectionId]);

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
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <button onClick={() => navigate('/portal/chat')} className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← All chats</button>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-16" />
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
      <div className="quiz-bg min-h-screen relative overflow-hidden">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Couldn't load this chat</p>
          <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
          <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
        </div>
      </div>
    );
  }

  const other = data?.other || {};

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden">
      {header}

      <div className="relative z-10 flex items-center justify-between max-w-lg mx-auto px-5 pt-5 pb-3">
        <Link to={`/portal/person/${other.user_id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={other.photo || AVATAR_FALLBACK} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
          <p className="font-sans text-cream font-semibold text-sm">{other.first_name || 'Guest'}</p>
        </Link>
        <button onClick={() => setShowReport(true)} className="font-sans text-cream/25 hover:text-red-400 text-xs transition-colors flex-shrink-0">
          Report
        </button>
      </div>

      <div ref={feedRef} className="relative z-10 max-w-lg mx-auto px-5 pb-40 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {(data.messages || []).length === 0 && (
          <div className="quiz-card text-center py-10 my-4">
            <p className="font-sans text-cream/40 text-sm">Say hi to {other.first_name || 'them'} 👋</p>
          </div>
        )}
        {(data.messages || []).map(msg => {
          const isOwn = msg.from_user_id === attendeeUser?.uid;
          return (
            <div key={msg.id} className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 font-sans text-sm ${
                  isOwn ? 'bg-gold text-navy rounded-br-sm' : 'bg-white/[0.06] text-cream rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.06] bg-[#16181d]/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${other.first_name || ''}…`}
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2.5 text-cream text-sm font-sans focus:outline-none focus:border-gold/40"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="quiz-cta text-xs py-2.5 px-4 disabled:opacity-40"
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
