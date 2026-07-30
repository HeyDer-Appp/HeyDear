import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import BottomNav from '../../components/BottomNav';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function Avatar({ photo, blurred, size = 32 }) {
  return (
    <img
      src={photo || AVATAR_FALLBACK}
      alt=""
      className="rounded-full object-cover flex-shrink-0 border border-white/10 transition-[filter] duration-700"
      style={{ width: size, height: size, filter: blurred ? 'blur(10px)' : 'none' }}
      draggable={false}
    />
  );
}

function PromptMessage({ msg, photo, blurred, onAnswer }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <Avatar photo={photo} blurred={blurred} />
      <div className="max-w-[75%]">
        <div className="bg-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-2.5">
          <p className="font-sans text-cream/35 text-[10px] uppercase tracking-widest mb-1">Asked</p>
          <p className="font-serif text-cream text-base leading-snug">{msg.prompt_text}</p>
        </div>
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) onAnswer(msg.id, e.target.value); }}
          className="mt-1.5 w-full bg-white/[0.04] border border-gold/25 rounded-xl px-3 py-2 text-cream/80 font-sans text-xs focus:outline-none focus:border-gold/60"
        >
          <option value="" disabled className="bg-navy text-cream/50">Tap to answer…</option>
          {(msg.prompt_options || []).map(opt => (
            <option key={opt} value={opt} className="bg-navy text-cream">{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AnswerMessage({ msg, photo, blurred, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={blurred} />
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOwn ? 'bg-gold text-navy rounded-br-sm' : 'bg-white/[0.06] text-cream rounded-bl-sm'
        }`}
      >
        <p className={`font-sans text-[10px] uppercase tracking-widest mb-1 ${isOwn ? 'text-navy/50' : 'text-cream/40'}`}>
          ↳ replied to "{msg.prompt_text}"
        </p>
        <p className="font-sans text-sm font-medium">{msg.option}</p>
      </div>
    </div>
  );
}

function TextMessage({ msg, photo, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={false} />
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 font-sans text-sm ${
          isOwn ? 'bg-gold text-navy rounded-br-sm' : 'bg-white/[0.06] text-cream rounded-bl-sm'
        }`}
      >
        {msg.text}
      </div>
    </div>
  );
}

export default function GroupChat() {
  const { attendeeUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showPicker, setShowPicker] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const feedRef = useRef(null);

  const fetchGroup = () => api.get('/group').then(res => setData(res.data)).catch(() => {});

  useEffect(() => {
    fetchGroup().finally(() => setLoading(false));
    const poll = setInterval(fetchGroup, 6000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [data?.messages?.length]);

  const photoByUser = {};
  (data?.members || []).forEach(m => { photoByUser[m.user_id] = m.photo; });

  const handleAsk = async (promptId) => {
    setShowPicker(false);
    try {
      const res = await api.post(`/group/${data.table_id}/prompts`, { promptId });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not post that prompt.');
    }
  };

  const handleAnswer = async (messageId, option) => {
    try {
      const res = await api.post(`/group/${data.table_id}/messages/${messageId}/answer`, { option });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that answer.');
    }
  };

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/group/${data.table_id}/messages`, { text: value });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
      setText('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const header = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
      <div className="w-10" />
    </nav>
  );

  if (!data?.has_group) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="text-4xl mb-4">👥</p>
          <h1 className="font-serif text-2xl text-cream mb-2">No group chat yet</h1>
          <p className="font-sans text-cream/40 text-sm">Once you're matched with a table, your group chat shows up here 48 hours before dinner.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!data.chat_open) {
    const msLeft = new Date(data.chat_opens_at) - now;
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8">
          <div className="quiz-card text-center py-12">
            <p className="text-4xl mb-4">🔒</p>
            <h1 className="font-serif text-2xl text-cream mb-2">Group chat opens soon</h1>
            <p className="font-sans text-cream/40 text-sm mb-6 leading-relaxed">
              You'll be able to meet your table with a few icebreakers 48 hours before dinner. Full profile photos and messaging unlock at 7:30pm on the night.
            </p>
            <p className="font-serif text-3xl text-gold tabular-nums">{formatCountdown(msLeft)}</p>
            <p className="font-sans text-cream/30 text-xs mt-1 uppercase tracking-widest">until it opens</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden">
      {header}

      {/* Blurred-until-revealed avatar strip */}
      <div className="relative z-10 max-w-lg mx-auto px-5 pt-5 pb-2">
        <p className="font-sans text-cream/40 text-xs mb-2">
          {data.revealed ? 'Your table tonight' : 'Your table — faces reveal at 7:30pm'}
        </p>
        <div className="flex items-center">
          {(data.members || []).map((m, i) => (
            <div key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i }}>
              <Avatar photo={m.photo} blurred={!data.revealed} size={44} />
            </div>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="relative z-10 max-w-lg mx-auto px-5 pt-2 pb-40 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {(data.messages || []).length === 0 && (
          <div className="quiz-card text-center py-10 my-4">
            <p className="font-sans text-cream/40 text-sm">No one's said anything yet. Break the ice with a question →</p>
          </div>
        )}
        {(data.messages || []).map(msg => {
          const isOwn = msg.user_id === attendeeUser?.uid;
          const photo = photoByUser[msg.user_id];
          if (msg.type === 'prompt') {
            return <PromptMessage key={msg.id} msg={msg} photo={photo} blurred={!data.revealed} onAnswer={handleAnswer} />;
          }
          if (msg.type === 'answer') {
            return <AnswerMessage key={msg.id} msg={msg} photo={photo} blurred={!data.revealed} isOwn={isOwn} />;
          }
          return <TextMessage key={msg.id} msg={msg} photo={photo} isOwn={isOwn} />;
        })}
      </div>

      {/* Composer */}
      <div className="fixed bottom-16 inset-x-0 z-30 border-t border-white/[0.06] bg-[#16181d]/95 backdrop-blur px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button
            onClick={() => setShowPicker(true)}
            title="Ask a question"
            className="flex-shrink-0 w-9 h-9 rounded-full border border-gold/30 text-gold flex items-center justify-center font-sans text-lg hover:bg-gold/10 transition-colors"
          >
            +
          </button>
          {data.revealed ? (
            <>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Message the group…"
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-full px-4 py-2.5 text-cream text-sm font-sans focus:outline-none focus:border-gold/40"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="quiz-cta text-xs py-2.5 px-4 disabled:opacity-40"
              >
                Send
              </button>
            </>
          ) : (
            <p className="flex-1 font-sans text-cream/30 text-xs px-1">🔒 Messaging opens at 7:30pm on dinner night</p>
          )}
        </div>
      </div>

      {/* Prompt picker */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowPicker(false)}>
          <div
            className="w-full max-w-lg bg-[#16181d] rounded-t-3xl max-h-[70vh] overflow-y-auto p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-serif text-xl text-cream mb-4">Ask the group</p>
            <div className="space-y-2">
              {(data.prompts || []).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAsk(p.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:border-gold/40 font-sans text-cream/80 text-sm transition-colors"
                >
                  {p.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
