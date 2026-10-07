import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { success as hapticSuccess } from '../../utils/haptics';
import ReportUserModal from '../../components/ReportUserModal';
import { usePolling } from '../../utils/usePolling';
import { ChatShell, ChatHeader, ChatComposer } from '../../components/ChatShell';

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

  const other = data?.other || {};
  const header = (
    <ChatHeader
      onBack={() => navigate('/portal/chat')}
      onInfo={other.user_id ? () => navigate(`/portal/person/${other.user_id}`) : undefined}
      members={other.user_id ? [{ user_id: other.user_id, photo: other.photo }] : []}
      blurred={false}
      title={other.first_name || (loading ? '' : 'Guest')}
      backLabel="Back to chats"
      right={other.user_id ? (
        <button onClick={() => setShowReport(true)} className="font-sans text-navy/40 hover:text-red-700 text-xs transition-colors flex-shrink-0 px-1">
          Report
        </button>
      ) : null}
    />
  );

  if (loading) {
    return (
      <ChatShell compact doodle={false}>
        {header}
        <div className="flex-1 px-4 py-6 space-y-3 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
              <div className={`h-10 rounded-2xl bg-navy/10 ${i === 1 ? 'w-40' : 'w-56'}`} />
            </div>
          ))}
        </div>
      </ChatShell>
    );
  }

  if (loadError && !data) {
    return (
      <ChatShell compact doodle={false}>
        {header}
        <div className="flex-1 px-5 py-16 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
      </ChatShell>
    );
  }

  const msgs = data?.messages || [];
  return (
    <ChatShell
      doodle={false}
      footer={(
        <ChatComposer
          value={text}
          onChange={setText}
          onSend={handleSend}
          disabled={!text.trim()}
          sending={sending}
        />
      )}
    >
      {header}

      {/* Messages scroll inside the panel; a short chat sits at the bottom, nearest the message field. */}
      <div ref={feedRef} data-no-ptr className="chat-feed flex-1 min-h-0 overflow-y-auto px-4 pb-3">
        <div className="min-h-full flex flex-col justify-end">
          {msgs.length === 0 && (
            <p className="font-sans text-navy/55 text-sm text-center py-10">👋</p>
          )}
          {msgs.map((msg, idx) => {
            const isOwn = msg.from_user_id === attendeeUser?.uid;
            const first = idx === 0 || msgs[idx - 1].from_user_id !== msg.from_user_id;
            return (
              <div key={msg.id} className={`flex mb-1.5 ${first ? 'mt-2.5' : ''} ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 font-sans text-sm ${
                    isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-white/85 text-navy rounded-bl-sm shadow-[0_1px_2px_rgba(22,24,29,0.08)]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showReport && (
        <ReportUserModal userId={other.user_id} userName={other.first_name} onClose={() => setShowReport(false)} />
      )}
    </ChatShell>
  );
}
