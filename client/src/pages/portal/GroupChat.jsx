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

function formatDinnerDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// The blur has to live on a wrapper with its own overflow:hidden — a filter
// applied straight to a rounded element isn't clipped by that element's own
// border-radius, so the blur bleeds outward into a shapeless haze instead of
// staying a crisp, contained circle sitting next to the message.
function Avatar({ photo, blurred, size = 32 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 border border-white/10"
      style={{ width: size, height: size }}
    >
      <img
        src={photo || AVATAR_FALLBACK}
        alt=""
        className="w-full h-full object-cover transition-[filter] duration-700"
        style={{ filter: blurred ? 'blur(4px)' : 'none', transform: blurred ? 'scale(1.15)' : 'scale(1)' }}
        draggable={false}
      />
    </div>
  );
}

function PromptMessage({ msg, photo, name, blurred, onAnswer }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <Avatar photo={photo} blurred={blurred} />
      <div className="max-w-[75%]">
        {name && <p className="font-sans text-cream/30 text-[10px] mb-1 ml-1">{name}</p>}
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

function AnswerMessage({ msg, photo, name, blurred, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={blurred} />
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {name && !isOwn && <p className="font-sans text-cream/30 text-[10px] mb-1 ml-1">{name}</p>}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn ? 'bg-gold text-navy rounded-br-sm' : 'bg-white/[0.06] text-cream rounded-bl-sm'
          }`}
        >
          <p className={`font-sans text-[10px] uppercase tracking-widest mb-1 ${isOwn ? 'text-navy/50' : 'text-cream/40'}`}>
            ↳ replied to "{msg.prompt_text}"
          </p>
          <p className="font-sans text-sm font-medium">{msg.option}</p>
        </div>
      </div>
    </div>
  );
}

function TextMessage({ msg, photo, name, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={false} />
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {name && !isOwn && <p className="font-sans text-cream/30 text-[10px] mb-1 ml-1">{name}</p>}
        <div
          className={`rounded-2xl px-4 py-2.5 font-sans text-sm ${
            isOwn ? 'bg-gold text-navy rounded-br-sm' : 'bg-white/[0.06] text-cream rounded-bl-sm'
          }`}
        >
          {msg.text}
        </div>
      </div>
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

function StatusBadge({ g }) {
  if (g.revealed) return <span className="text-emerald-400 text-[10px] font-sans font-semibold uppercase tracking-widest">Attended</span>;
  if (g.chat_open) return <span className="text-gold text-[10px] font-sans font-semibold uppercase tracking-widest">Open</span>;
  return <span className="text-cream/30 text-[10px] font-sans font-semibold uppercase tracking-widest">Locked</span>;
}

function GroupListCard({ g, onOpen, onExit }) {
  return (
    <div className="quiz-card">
      <div className="flex items-center justify-between mb-1">
        <p className="font-serif text-lg text-cream">{formatDinnerDate(g.dinner_date)}</p>
        <StatusBadge g={g} />
      </div>
      <p className="font-sans text-cream/40 text-xs mb-4">{g.city} · {g.member_count} people</p>
      <div className="flex items-center gap-4">
        <button onClick={() => onOpen(g.table_id)} className="quiz-cta text-xs py-2 px-5">Open chat</button>
        <button onClick={() => onExit(g.table_id)} className="font-sans text-cream/30 hover:text-red-400 text-xs transition-colors">Exit group</button>
      </div>
    </div>
  );
}

// The list of every group chat this attendee belongs to — split into the
// upcoming Tuesday (still building up to the reveal) and dinners already
// attended (fully unlocked). Each is independently selectable and exitable.
function GroupList({ onOpen }) {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchGroups = () => api.get('/group')
    .then(res => { setGroups(res.data.groups || []); setLoadError(false); })
    .catch(() => setLoadError(true));

  useEffect(() => {
    fetchGroups().finally(() => setLoading(false));
    const poll = setInterval(fetchGroups, 20000);
    return () => clearInterval(poll);
  }, []);

  const handleExit = async (tableId) => {
    if (!confirm("Remove this group from your list? You won't see it here anymore.")) return;
    try {
      await api.post(`/group/${tableId}/exit`);
      setGroups(prev => prev.filter(g => g.table_id !== tableId));
      toast.success('Left the group.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not leave that group.');
    }
  };

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError && !groups) {
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Couldn't load your groups</p>
          <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
          <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const upcoming = (groups || []).filter(g => !g.revealed);
  const attended = (groups || []).filter(g => g.revealed);

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      {header}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="font-sans text-cream/40 text-sm">Your dinners</p>
          <h1 className="font-serif text-3xl text-cream mt-1">Group Chats</h1>
        </div>

        {(groups || []).length === 0 && (
          <div className="quiz-card text-center py-10">
            <p className="font-sans text-cream/40 text-sm">Once you're matched with a table, your group chat shows up here 48 hours before dinner.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">Upcoming</p>
            {upcoming.map(g => <GroupListCard key={g.table_id} g={g} onOpen={onOpen} onExit={handleExit} />)}
          </div>
        )}

        {attended.length > 0 && (
          <div className="space-y-3">
            <p className="font-sans font-semibold text-cream/50 text-xs uppercase tracking-widest">Attended</p>
            {attended.map(g => <GroupListCard key={g.table_id} g={g} onOpen={onOpen} onExit={handleExit} />)}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

// One group's chat: locked countdown before the 48h mark, blurred prompts
// feed once open, full reveal (clear photos, real names + free text) at
// 8pm — and for anything already attended, that reveal has naturally
// already happened.
function GroupDetail({ tableId, onBack }) {
  const { attendeeUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showPicker, setShowPicker] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const feedRef = useRef(null);

  const fetchGroup = () => api.get(`/group/${tableId}`)
    .then(res => { setData(res.data); setLoadError(false); })
    .catch(() => setLoadError(true));

  useEffect(() => {
    setLoading(true);
    fetchGroup().finally(() => setLoading(false));
    // Shares the site-wide API rate limit with every other request on this
    // connection, so this has to stay well under budget for a tab left open.
    const poll = setInterval(fetchGroup, 15000);
    return () => clearInterval(poll);
  }, [tableId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [data?.messages?.length]);

  const photoByUser = {};
  const nameByUser = {};
  (data?.members || []).forEach(m => { photoByUser[m.user_id] = m.photo; nameByUser[m.user_id] = m.first_name; });

  const handleAsk = async (promptId) => {
    setShowPicker(false);
    try {
      const res = await api.post(`/group/${tableId}/prompts`, { promptId });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not post that prompt.');
    }
  };

  const handleAnswer = async (messageId, option) => {
    try {
      const res = await api.post(`/group/${tableId}/messages/${messageId}/answer`, { option });
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
      const res = await api.post(`/group/${tableId}/messages`, { text: value });
      setData(prev => ({ ...prev, messages: [...(prev.messages || []), res.data.message] }));
      setText('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const detailHeader = (
    <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
      <button onClick={onBack} className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← All groups</button>
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
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {detailHeader}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Couldn't load this group chat</p>
          <p className="font-sans text-cream/50 text-sm mb-6">Please refresh, or contact info@heyder.nz if this keeps happening.</p>
          <button onClick={() => window.location.reload()} className="quiz-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!data?.chat_open) {
    const msLeft = data ? new Date(data.chat_opens_at) - now : 0;
    return (
      <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
        {detailHeader}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8">
          <div className="quiz-card text-center py-12">
            <p className="text-4xl mb-4">🔒</p>
            <h1 className="font-serif text-2xl text-cream mb-2">Group chat opens soon</h1>
            <p className="font-sans text-cream/40 text-sm mb-6 leading-relaxed">
              You'll be able to meet your table with a few icebreakers 48 hours before dinner. Full profiles — names, photos — and messaging unlock at 8pm on the night.
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
      {detailHeader}

      {/* Blurred-until-revealed avatar strip */}
      <div className="relative z-10 max-w-lg mx-auto px-5 pt-5 pb-2">
        <p className="font-sans text-cream/40 text-xs mb-2">
          {data.revealed ? 'Your table' : 'Your table — names & faces reveal at 8pm'}
        </p>
        <div className="flex items-start gap-4 flex-wrap">
          {(data.members || []).map(m => (
            <div key={m.user_id} className="flex flex-col items-center w-14">
              <Avatar photo={m.photo} blurred={!data.revealed} size={44} />
              <p className="font-sans text-cream/60 text-[10px] mt-1 truncate max-w-full">
                {data.revealed ? (m.first_name || 'Guest') : '•••'}
              </p>
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
          const name = data.revealed ? (nameByUser[msg.user_id] || 'Guest') : null;
          if (msg.type === 'prompt') {
            return <PromptMessage key={msg.id} msg={msg} photo={photo} name={name} blurred={!data.revealed} onAnswer={handleAnswer} />;
          }
          if (msg.type === 'answer') {
            return <AnswerMessage key={msg.id} msg={msg} photo={photo} name={name} blurred={!data.revealed} isOwn={isOwn} />;
          }
          return <TextMessage key={msg.id} msg={msg} photo={photo} name={name} isOwn={isOwn} />;
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
            <p className="flex-1 font-sans text-cream/30 text-xs px-1">🔒 Messaging opens at 8pm on dinner night</p>
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

export default function GroupChat() {
  const [selectedTableId, setSelectedTableId] = useState(null);

  if (selectedTableId) {
    return <GroupDetail tableId={selectedTableId} onBack={() => setSelectedTableId(null)} />;
  }
  return <GroupList onOpen={setSelectedTableId} />;
}
