import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ArrowUp, Plus } from 'lucide-react';
import DoodleWall from './DoodleWall';

const AVATAR_FALLBACK = 'https://heyder.nz/wp-content/uploads/2026/06/account-2.png';

// The blur has to live on a wrapper with its own overflow:hidden — a filter
// applied straight to a rounded element isn't clipped by that element's own
// border-radius, so the blur bleeds outward into a shapeless haze instead of
// staying a crisp, contained circle sitting next to the message.
export function Avatar({ photo, blurred, size = 32 }) {
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

// One calm cream panel holds the whole conversation, header included; the
// doodles show around it and below, behind the message field and nav pill.
export function ChatShell({ children, footer, compact = false, doodle = true }) {
  const ref = useRef(null);

  // iOS pans the whole page up when the keyboard opens, which would shove the
  // header off the top. Pin this screen to exactly what is visible instead
  // (top = how far the page was panned, height = visible height above the keyboard).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return undefined;
    const update = () => {
      if (document.documentElement.classList.contains('keyboard-open')) {
        el.style.top = `${vv.offsetTop}px`;
        el.style.height = `${vv.height}px`;
      } else {
        el.style.top = '';
        el.style.height = '';
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); mo.disconnect(); };
  }, []);

  return (
    <div ref={ref} className={`portal-bg ${doodle ? 'doodle-page ' : ''}chat-screen overflow-hidden`}>
      {doodle && <DoodleWall still />}
      <section className={`chat-panel ${compact ? 'chat-panel-compact' : ''}`}>{children}</section>
      {footer}
    </div>
  );
}

export function ChatHeader({ onBack, onInfo, members, blurred, title, subtitle, backLabel = 'Back', right = null }) {
  const shown = (members || []).slice(0, 3);
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2 flex-shrink-0">
      <button
        onClick={onBack}
        aria-label={backLabel}
        className="w-9 h-9 flex-shrink-0 rounded-full bg-white/70 text-navy/70 hover:text-navy flex items-center justify-center transition-colors"
      >
        <ChevronLeft size={22} strokeWidth={2} />
      </button>
      <button
        onClick={onInfo}
        disabled={!onInfo}
        className="flex-1 min-w-0 flex items-center gap-2.5 text-left disabled:cursor-default"
      >
        {shown.length > 0 && (
          <div className="flex items-center flex-shrink-0">
            {shown.map((m, i) => (
              <div key={m.user_id} className={`rounded-full ${i ? '-ml-2.5' : ''}`} style={{ boxShadow: '0 0 0 2px #F5EDD8' }}>
                <Avatar photo={m.photo} blurred={blurred} size={32} />
              </div>
            ))}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-serif font-bold text-navy text-xl leading-tight truncate">{title}</p>
          {subtitle && <p className="font-sans text-navy/55 text-xs truncate">{subtitle}</p>}
        </div>
      </button>
      {right}
    </div>
  );
}


// The message field floating above the nav pill — the same in every chat.
export function ChatComposer({ value, onChange, onSend, disabled, sending, onPlus, lockedText }) {
  return (
    <div className="absolute inset-x-0 z-30 px-3.5" style={{ bottom: 'calc(var(--nav-top) + 8px)' }}>
      <div className="max-w-lg mx-auto flex items-center gap-1 rounded-full bg-cream pl-2 pr-1.5 h-12 shadow-[0_4px_14px_rgba(22,24,29,0.10)]">
        {onPlus ? (
          <button
            onClick={onPlus}
            title="Ask a question"
            aria-label="Ask a question"
            className="flex-shrink-0 w-9 h-9 rounded-full text-plum flex items-center justify-center hover:bg-plum/10 transition-colors"
          >
            <Plus size={20} strokeWidth={2} />
          </button>
        ) : <span className="w-2" />}
        {lockedText ? (
          <p className="flex-1 px-1.5 font-sans text-navy/65 text-sm">{lockedText}</p>
        ) : (
          <>
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSend()}
              placeholder="Message"
              className="flex-1 min-w-0 bg-transparent px-1.5 text-navy text-[15px] font-sans placeholder:text-navy/40 focus:outline-none"
            />
            <button
              onClick={onSend}
              disabled={disabled || sending}
              aria-label="Send"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-plum text-cream flex items-center justify-center disabled:opacity-35 transition-opacity"
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
