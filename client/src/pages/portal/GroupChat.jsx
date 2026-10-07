import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { success as hapticSuccess } from '../../utils/haptics';
import BottomNav from '../../components/BottomNav';
import ProfileAvatar from '../../components/ProfileAvatar';
import { flagUrl } from '../../utils/flags';
import { GlimpseModal } from './Dashboard';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { Stagger, Rise } from '../../components/Motion';
import { ChevronRight } from 'lucide-react';
import DoodleWall from '../../components/DoodleWall';

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
  return new Date(iso).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

// The blur has to live on a wrapper with its own overflow:hidden — a filter
// applied straight to a rounded element isn't clipped by that element's own
// border-radius, so the blur bleeds outward into a shapeless haze instead of
// staying a crisp, contained circle sitting next to the message.
function Avatar({ photo, blurred, size = 32 }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 border border-navy/15"
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

// Windows doesn't render Unicode flag emoji as actual flags (just plain
// "NZ"/"IN" letters), so this is a real flag image instead.
function NameTag({ name, country }) {
  if (!name) return null;
  return (
    <p className="font-sans text-navy/55 text-[10px] mb-1 ml-1 inline-flex items-center gap-1 bg-cream rounded-full px-2 py-0.5">
      {name}
      {country && flagUrl(country) && <img src={flagUrl(country)} alt={country} className="h-2.5 rounded-[1px]" />}
    </p>
  );
}

// Custom radio rows instead of a native <select> — picking an option
// answers immediately (no separate submit step), so the tapped row fills
// gold right away and the rest dim out while the answer posts.
function PromptOptions({ options, onSelect }) {
  const [choice, setChoice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePick = async (opt) => {
    if (submitting) return;
    setChoice(opt);
    setSubmitting(true);
    try {
      await onSelect(opt);
    } catch {
      setChoice(null);
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-1.5 space-y-1.5">
      {options.map(opt => {
        const active = choice === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handlePick(opt)}
            disabled={submitting}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left font-sans text-xs transition-all duration-200 ${
              active
                ? 'border-plum bg-plum/10 text-navy shadow-[0_4px_20px_rgba(232,168,84,0.15)]'
                : 'border-navy/15 bg-cream text-navy/80 hover:border-plum/40 hover:bg-cream'
            } ${submitting && !active ? 'opacity-35' : ''}`}
          >
            <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
              active ? 'border-plum' : 'border-navy/25'
            }`}>
              <span className={`w-2 h-2 rounded-full bg-plum transition-transform duration-200 ${active ? 'scale-100' : 'scale-0'}`} />
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function PromptMessage({ msg, photo, name, country, blurred, onAnswer, isOwn, myAnswer }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={blurred} />
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && <NameTag name={name} country={country} />}
        <div className={`rounded-2xl px-4 py-2.5 ${isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-cream text-navy rounded-bl-sm'}`}>
          <p className={`font-sans text-[10px] uppercase tracking-widest mb-1 ${isOwn ? 'text-cream/80' : 'text-navy/50'}`}>Asked</p>
          <p className={isOwn ? 'font-sans text-sm font-medium' : 'font-serif text-base leading-snug'}>{msg.prompt_text}</p>
        </div>
        {/* You can't answer your own question — server enforces this too,
            this just keeps the picker from showing up in the first place. Once
            you've answered, the picker is replaced with what you picked —
            same server-side rule (one answer per prompt) backs this too. */}
        {isOwn ? (
          <p className="mt-1.5 inline-block bg-cream rounded-full px-2.5 py-0.5 font-sans text-navy/55 text-[11px] italic">Your question — waiting on answers</p>
        ) : myAnswer ? (
          <p className="mt-1.5 inline-block bg-cream rounded-full px-2.5 py-0.5 font-sans text-navy/65 text-[11px]">You answered: <span className="text-plum font-medium">{myAnswer}</span></p>
        ) : (
          <PromptOptions options={msg.prompt_options || []} onSelect={(opt) => onAnswer(msg.id, opt)} />
        )}
      </div>
    </div>
  );
}

function AnswerMessage({ msg, photo, name, country, blurred, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={blurred} />
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && <NameTag name={name} country={country} />}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-cream text-navy rounded-bl-sm'
          }`}
        >
          <p className={`font-sans text-[10px] uppercase tracking-widest mb-1 ${isOwn ? 'text-cream/80' : 'text-navy/55'}`}>
            ↳ replied to "{msg.prompt_text}"
          </p>
          <p className="font-sans text-sm font-medium">{msg.option}</p>
        </div>
      </div>
    </div>
  );
}

function TextMessage({ msg, photo, name, country, isOwn }) {
  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar photo={photo} blurred={false} />
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && <NameTag name={name} country={country} />}
        <div
          className={`rounded-2xl px-4 py-2.5 font-sans text-sm ${
            isOwn ? 'bg-plum text-cream font-medium rounded-br-sm' : 'bg-cream text-navy rounded-bl-sm'
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

const header = (
  <nav
    className="relative z-10 flex items-center justify-between px-6 pb-5"
    style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
  >
    <Link to="/portal/dashboard" className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
    <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
    <ProfileAvatar />
  </nav>
);

function formatRowDate(iso) {
  if (!iso) return { weekday: '', day: '' };
  const d = new Date(iso);
  const opts = { timeZone: 'Pacific/Auckland' };
  return {
    weekday: d.toLocaleDateString('en-NZ', { ...opts, weekday: 'long' }),
    day: d.toLocaleDateString('en-NZ', { ...opts, day: 'numeric', month: 'long' }),
  };
}

function GroupListCard({ g, onOpen }) {
  const members = g.members || [];
  const shown = members.slice(0, 3);
  const { weekday, day } = formatRowDate(g.dinner_date);
  return (
    <button onClick={() => onOpen(g.table_id)} className="group-row w-full text-left flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-sans font-semibold text-navy/50 text-[10px] uppercase tracking-[0.18em] flex items-center gap-1.5">
          {weekday}
          {g.has_unread && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
        </p>
        <p className="font-serif font-bold text-navy text-xl leading-tight whitespace-nowrap">{day}</p>
      </div>
      {shown.length > 0 ? (
        <div className="flex items-center flex-shrink-0">
          {shown.map((m, i) => (
            <div key={m.user_id} className={`rounded-full ${i ? '-ml-2.5' : ''}`} style={{ boxShadow: '0 0 0 2px #F5EDD8' }}>
              <Avatar photo={m.photo} blurred={!g.revealed} size={32} />
            </div>
          ))}
          {members.length > shown.length && (
            <div className="-ml-2.5 w-[32px] h-[32px] rounded-full bg-[#E7DFC5] flex items-center justify-center text-navy text-[11px] font-sans font-semibold" style={{ boxShadow: '0 0 0 2px #F5EDD8' }}>
              +{members.length - shown.length}
            </div>
          )}
        </div>
      ) : (
        <span className="font-sans text-navy/50 text-xs flex-shrink-0">{g.member_count} people</span>
      )}
      <ChevronRight size={18} strokeWidth={2} className="text-navy/35 flex-shrink-0" />
    </button>
  );
}

// The list of every group chat this attendee belongs to — split into the
// upcoming Tuesday (still building up to the reveal) and dinners already
// attended (fully unlocked). Each is independently selectable and exitable.
function GroupList({ onOpen }) {
  const { data: groups, loading, error: loadError, refetch } = useCachedFetch(
    'portal_groups',
    async () => (await api.get('/group')).data.groups || []
  );

  useEffect(() => {
    const poll = setInterval(() => refetch({ silent: true }).catch(() => {}), 20000);
    return () => clearInterval(poll);
  }, [refetch]);

  if (loading) {
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall />
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
          <h1 className="doodle-label font-serif font-bold text-3xl text-navy">Groups</h1>
          <div className="space-y-3 animate-pulse">
            {[0, 1].map(i => (
              <div key={i} className="glass-card space-y-3">
                <div className="h-5 w-36 rounded bg-white/40" />
                <div className="h-3 w-28 rounded bg-white/40" />
                <div className="h-8 w-24 rounded-full bg-white/40" />
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loadError && !groups) {
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall />
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Only the next dinner not yet attended is listed — later ones stay hidden
  // until it's been attended (revealed), then the following one takes its place.
  const nextUpcoming = (groups || [])
    .filter(g => !g.revealed)
    .sort((a, b) => new Date(a.dinner_date) - new Date(b.dinner_date))[0];
  const visibleGroups = (groups || []).filter(g => g.revealed || g === nextUpcoming);

  return (
    <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
      <DoodleWall />
      {header}
      <Stagger className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
        <Rise><h1 className="doodle-label font-serif font-bold text-3xl text-navy">Groups</h1></Rise>

        {visibleGroups.length === 0 && (
          <Rise className="glass-card text-center py-10">
            <p className="font-sans text-navy/55 text-sm">Opens 48h before dinner.</p>
          </Rise>
        )}

        {visibleGroups.length > 0 && (
          <div className="space-y-3">
            {visibleGroups.map(g => <Rise key={g.table_id}><GroupListCard g={g} onOpen={onOpen} /></Rise>)}
          </div>
        )}
      </Stagger>
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
  const [showGroupInfo, setShowGroupInfo] = useState(false);
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
  const countryByUser = {};
  (data?.members || []).forEach(m => {
    photoByUser[m.user_id] = m.photo;
    nameByUser[m.user_id] = m.first_name;
    countryByUser[m.user_id] = m.country;
  });

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
      throw err; // lets PromptOptions un-select and re-enable its radios
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
      hapticSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const detailHeader = (
    <nav
      className="relative z-10 flex items-center justify-between px-6 pb-5"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <button onClick={onBack} className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← All groups</button>
      <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
      <ProfileAvatar />
    </nav>
  );

  if (loading) {
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall still />
        {detailHeader}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-3 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className={`flex items-end gap-2 ${i % 2 ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-white/40 flex-shrink-0" />
              <div className={`h-10 rounded-2xl bg-white/40 ${i === 1 ? 'w-40' : 'w-56'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall still />
        {detailHeader}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-20 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!data?.chat_open) {
    const msLeft = data ? new Date(data.chat_opens_at) - now : 0;
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall still />
        {detailHeader}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8">
          <div className="glass-card text-center py-12">
            <p className="text-4xl mb-4">🔒</p>
            <p className="font-serif font-bold text-4xl text-plum tabular-nums">{formatCountdown(msLeft)}</p>
            <p className="font-sans text-navy/55 text-xs mt-2 uppercase tracking-widest">Opens soon</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="portal-bg doodle-page min-h-screen relative overflow-hidden">
      <DoodleWall still />
      {detailHeader}

      {/* Compact group-info bar — tap to see everyone, WhatsApp-style */}
      <button
        onClick={() => setShowGroupInfo(true)}
        className="relative z-10 w-full max-w-lg mx-auto px-5 py-3 flex items-center gap-3 text-left border-b border-navy/10 bg-beige"
      >
        <div className="flex -space-x-2 flex-shrink-0">
          {(data.members || []).slice(0, 5).map(m => (
            <div key={m.user_id} className="rounded-full ring-2 ring-beige">
              <Avatar photo={m.photo} blurred={!data.revealed} size={28} />
            </div>
          ))}
          {(data.members || []).length > 5 && (
            <div className="w-7 h-7 rounded-full ring-2 ring-beige bg-cream flex items-center justify-center text-navy/72 text-[10px] font-sans font-semibold">
              +{data.members.length - 5}
            </div>
          )}
        </div>
        <p className="font-sans text-navy/55 text-xs">
          {data.revealed ? 'Your table' : 'Names at 8pm'}
        </p>
      </button>

      {showGroupInfo && <GlimpseModal tableId={tableId} onClose={() => setShowGroupInfo(false)} />}

      {/* Feed */}
      <div ref={feedRef} className="relative z-10 max-w-lg mx-auto px-5 pt-2 overflow-y-auto" style={{ paddingBottom: 'calc(var(--nav-top) + 96px)', maxHeight: 'calc(100vh - 220px)' }}>
        {(data.messages || []).length === 0 && (
          <div className="glass-card text-center py-10 my-4">
            <p className="font-sans text-navy/55 text-sm">Ask a question +</p>
          </div>
        )}
        {(data.messages || []).map(msg => {
          const isOwn = msg.user_id === attendeeUser?.uid;
          const photo = photoByUser[msg.user_id];
          const country = countryByUser[msg.user_id];
          const name = data.revealed ? (nameByUser[msg.user_id] || 'Guest') : null;
          if (msg.type === 'prompt') {
            const myAnswer = (data.messages || []).find(
              m => m.type === 'answer' && m.reply_to_id === msg.id && m.user_id === attendeeUser?.uid
            )?.option;
            return <PromptMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} blurred={!data.revealed} onAnswer={handleAnswer} isOwn={isOwn} myAnswer={myAnswer} />;
          }
          if (msg.type === 'answer') {
            return <AnswerMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} blurred={!data.revealed} isOwn={isOwn} />;
          }
          return <TextMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} isOwn={isOwn} />;
        })}
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 z-30 bg-beige px-4 py-2.5" style={{ bottom: 'calc(var(--nav-top) + 8px)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <button
            onClick={() => setShowPicker(true)}
            title="Ask a question"
            className="flex-shrink-0 w-9 h-9 rounded-full border border-plum/30 text-plum flex items-center justify-center font-sans text-lg hover:bg-plum/10 transition-colors"
          >
            +
          </button>
          {data.revealed ? (
            <>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Message"
                className="flex-1 bg-cream border border-navy/15 rounded-full px-4 py-2.5 text-navy text-sm font-sans focus:outline-none focus:border-plum/40"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="plum-cta text-xs py-2.5 px-4 disabled:opacity-40"
              >
                Send
              </button>
            </>
          ) : (
            <div className="flex-1 px-1">
              <p className="font-sans text-navy/65 text-sm">🔒 Opens 8pm on the night</p>
            </div>
          )}
        </div>
      </div>

      {/* Prompt picker */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setShowPicker(false)}>
          <div
            className="w-full max-w-lg bg-cream rounded-t-3xl max-h-[70vh] overflow-y-auto p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-serif font-bold text-xl text-navy mb-4">Ask</p>
            <div className="space-y-2">
              {(data.prompts || []).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAsk(p.id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-navy/15 hover:border-plum/40 font-sans text-navy/85 text-sm transition-colors"
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
