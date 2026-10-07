import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { success as hapticSuccess } from '../../utils/haptics';
import ProfileAvatar from '../../components/ProfileAvatar';
import TabHeader from '../../components/TabHeader';
import { usePolling } from '../../utils/usePolling';
import { flagUrl } from '../../utils/flags';
import { GlimpseModal } from './Dashboard';
import { useCachedFetch } from '../../utils/useCachedFetch';
import { Stagger, Rise } from '../../components/Motion';
import { ChevronRight } from 'lucide-react';
import DoodleWall from '../../components/DoodleWall';
import { Avatar, ChatShell, ChatHeader, ChatComposer } from '../../components/ChatShell';

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

// Windows doesn't render Unicode flag emoji as actual flags (just plain
// "NZ"/"IN" letters), so this is a real flag image instead.
function NameTag({ name, country }) {
  if (!name) return null;
  return (
    <p className="font-sans text-navy/55 text-[11px] mb-0.5 ml-1 inline-flex items-center gap-1">
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
                : 'border-navy/10 bg-white/70 text-navy/80 hover:border-plum/40'
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

function PromptMessage({ msg, photo, name, country, blurred, onAnswer, isOwn, myAnswer, first = true }) {
  return (
    <div className={`flex items-end gap-2 mb-1.5 ${first ? 'mt-2.5' : ''} ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && (first ? <Avatar photo={photo} blurred={blurred} /> : <div className="w-8 flex-shrink-0" />)}
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && first && <NameTag name={name} country={country} />}
        <div className={`rounded-2xl px-4 py-2.5 ${isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-white/85 text-navy rounded-bl-sm shadow-[0_1px_2px_rgba(22,24,29,0.08)]'}`}>
          <p className={`font-sans text-[11px] mb-0.5 ${isOwn ? 'text-cream/75' : 'text-navy/50'}`}>Asked</p>
          <p className={isOwn ? 'font-sans text-sm font-medium' : 'font-serif text-base leading-snug'}>{msg.prompt_text}</p>
        </div>
        {/* You can't answer your own question — server enforces this too,
            this just keeps the picker from showing up in the first place. Once
            you've answered, the picker is replaced with what you picked —
            same server-side rule (one answer per prompt) backs this too. */}
        {isOwn ? (
          <p className="mt-1.5 inline-block bg-navy/5 rounded-full px-2.5 py-0.5 font-sans text-navy/55 text-[11px] italic">Your question — waiting on answers</p>
        ) : myAnswer ? (
          <p className="mt-1.5 inline-block bg-navy/5 rounded-full px-2.5 py-0.5 font-sans text-navy/65 text-[11px]">You answered: <span className="text-plum font-medium">{myAnswer}</span></p>
        ) : (
          <PromptOptions options={msg.prompt_options || []} onSelect={(opt) => onAnswer(msg.id, opt)} />
        )}
      </div>
    </div>
  );
}

function AnswerMessage({ msg, photo, name, country, blurred, isOwn, first = true }) {
  return (
    <div className={`flex items-end gap-2 mb-1.5 ${first ? 'mt-2.5' : ''} ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && (first ? <Avatar photo={photo} blurred={blurred} /> : <div className="w-8 flex-shrink-0" />)}
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && first && <NameTag name={name} country={country} />}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOwn ? 'bg-plum text-cream rounded-br-sm' : 'bg-white/85 text-navy rounded-bl-sm shadow-[0_1px_2px_rgba(22,24,29,0.08)]'
          }`}
        >
          <p className={`font-sans text-[11px] leading-snug mb-1 pl-2 border-l-2 ${isOwn ? 'text-cream/75 border-cream/50' : 'text-navy/55 border-plum/50'}`}>
            {msg.prompt_text}
          </p>
          <p className="font-sans text-sm font-medium">{msg.option}</p>
        </div>
      </div>
    </div>
  );
}

function TextMessage({ msg, photo, name, country, isOwn, first = true }) {
  return (
    <div className={`flex items-end gap-2 mb-1.5 ${first ? 'mt-2.5' : ''} ${isOwn ? 'flex-row-reverse' : ''}`}>
      {!isOwn && (first ? <Avatar photo={photo} blurred={false} /> : <div className="w-8 flex-shrink-0" />)}
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        {!isOwn && first && <NameTag name={name} country={country} />}
        <div
          className={`rounded-2xl px-4 py-2.5 font-sans text-sm ${
            isOwn ? 'bg-plum text-cream font-medium rounded-br-sm' : 'bg-white/85 text-navy rounded-bl-sm shadow-[0_1px_2px_rgba(22,24,29,0.08)]'
          }`}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

const header = <TabHeader title="Groups" doodle />;

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

  // Visible-only polling (see usePolling): no database reads while the app is in the background.
  usePolling(() => refetch({ silent: true }), 20000);

  if (loading) {
    return (
      <div className="portal-bg doodle-page min-h-screen relative overflow-hidden pb-nav">
        <DoodleWall />
        {header}
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
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
  }, [tableId]);

  // Shares the site-wide API rate limit and the database's daily quota with every
  // other request, so it only polls while the app is actually on screen.
  usePolling(fetchGroup, 15000);

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

  const members = data?.members || [];
  const { weekday, day } = formatRowDate(data?.dinner_date);
  const subtitle = data ? `${weekday ? weekday.slice(0, 3) + ' ' : ''}${day} · ${members.length} people` : '';
  const detailHeader = (
    <ChatHeader
      onBack={onBack}
      onInfo={data?.chat_open ? () => setShowGroupInfo(true) : undefined}
      members={members}
      blurred={data ? !data.revealed : true}
      title={data && !data.revealed ? 'Names at 8pm' : 'Your table'}
      subtitle={subtitle}
    />
  );

  if (loading) {
    return (
      <ChatShell compact>
        {detailHeader}
        <div className="flex-1 px-4 py-6 space-y-3 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className={`flex items-end gap-2 ${i % 2 ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-navy/10 flex-shrink-0" />
              <div className={`h-10 rounded-2xl bg-navy/10 ${i === 1 ? 'w-40' : 'w-56'}`} />
            </div>
          ))}
        </div>
      </ChatShell>
    );
  }

  if (loadError && !data) {
    return (
      <ChatShell compact>
        {detailHeader}
        <div className="flex-1 px-5 py-16 text-center">
          <p className="font-serif text-2xl text-navy mb-3">Couldn't load.</p>
          <button onClick={() => window.location.reload()} className="plum-cta text-xs py-2 px-6">Retry</button>
        </div>
      </ChatShell>
    );
  }

  if (!data?.chat_open) {
    const msLeft = data ? new Date(data.chat_opens_at) - now : 0;
    return (
      <ChatShell compact>
        {detailHeader}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-10">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-serif font-bold text-4xl text-plum tabular-nums">{formatCountdown(msLeft)}</p>
          <p className="font-sans text-navy/55 text-xs mt-2 uppercase tracking-widest">Opens soon</p>
        </div>
      </ChatShell>
    );
  }

  const msgs = data.messages || [];
  return (
    <ChatShell
      footer={(
        <ChatComposer
          value={text}
          onChange={setText}
          onSend={handleSend}
          disabled={!text.trim()}
          sending={sending}
          onPlus={() => setShowPicker(true)}
          lockedText={data.revealed ? null : '🔒 Opens 8pm on the night'}
        />
      )}
    >
      {detailHeader}

      {showGroupInfo && <GlimpseModal tableId={tableId} onClose={() => setShowGroupInfo(false)} />}

      {/* Feed — scrolls inside the panel; a short chat sits at the bottom, nearest the message field. */}
      <div ref={feedRef} data-no-ptr className="chat-feed flex-1 min-h-0 overflow-y-auto px-4 pb-3">
        <div className="min-h-full flex flex-col justify-end">
          {msgs.length === 0 && (
            <p className="font-sans text-navy/55 text-sm text-center py-10">Ask a question +</p>
          )}
          {msgs.map((msg, idx) => {
            const isOwn = msg.user_id === attendeeUser?.uid;
            const photo = photoByUser[msg.user_id];
            const country = countryByUser[msg.user_id];
            const name = data.revealed ? (nameByUser[msg.user_id] || 'Guest') : null;
            const first = idx === 0 || msgs[idx - 1].user_id !== msg.user_id;
            if (msg.type === 'prompt') {
              const myAnswer = msgs.find(
                m => m.type === 'answer' && m.reply_to_id === msg.id && m.user_id === attendeeUser?.uid
              )?.option;
              return <PromptMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} blurred={!data.revealed} onAnswer={handleAnswer} isOwn={isOwn} myAnswer={myAnswer} first={first} />;
            }
            if (msg.type === 'answer') {
              return <AnswerMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} blurred={!data.revealed} isOwn={isOwn} first={first} />;
            }
            return <TextMessage key={msg.id} msg={msg} photo={photo} name={name} country={country} isOwn={isOwn} first={first} />;
          })}
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
    </ChatShell>
  );
}

export default function GroupChat() {
  const [selectedTableId, setSelectedTableId] = useState(null);

  if (selectedTableId) {
    return <GroupDetail tableId={selectedTableId} onBack={() => setSelectedTableId(null)} />;
  }
  return <GroupList onOpen={setSelectedTableId} />;
}
