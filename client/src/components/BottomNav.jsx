import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Image, Users, MessageCircle } from 'lucide-react';
import api from '../utils/api';

// Fork, plate, spoon — traced from a reference icon, filled solid instead
// of outlined like the other four nav icons. currentColor so it still
// tints gold on the active tab.
function PlateForkSpoonIcon() {
  return (
    <svg width="31" height="25" viewBox="0 0 30 24" fill="currentColor">
      <rect x="0.2" y="1.5" width="1" height="6.5" rx="0.5" />
      <rect x="1.7" y="1.5" width="1" height="6.5" rx="0.5" />
      <rect x="3.2" y="1.5" width="1" height="6.5" rx="0.5" />
      <rect x="4.7" y="1.5" width="1" height="6.5" rx="0.5" />
      <path d="M0.2 7h5.5v1.2c0 1.8-1.2 2.8-2.75 2.8S0.2 10 0.2 8.2Z" />
      <rect x="2.2" y="10.5" width="1.3" height="11.5" rx="0.6" />
      <circle cx="15" cy="12" r="8.3" />
      <ellipse cx="25.5" cy="5" rx="2.6" ry="3.6" />
      <rect x="24.85" y="8" width="1.3" height="14" rx="0.6" />
    </svg>
  );
}

// Profile lives in the top-right (ProfileAvatar), not here.
const ITEMS = [
  { to: '/portal/album', icon: Image, label: 'Album' },
  { to: '/portal/group-chat', icon: Users, label: 'Group' },
  { to: '/portal/dashboard', icon: PlateForkSpoonIcon, label: 'My Table' },
  { to: '/portal/chat', icon: MessageCircle, label: 'Chat' },
];

// Swipe left/right anywhere on a tab screen to move to the neighbouring tab
// (Album ← Group ← My Table → Chat order, no wrap-around), like flicking
// between tabs in Instagram. Deliberately conservative so it never fights
// scrolling, sliders, text fields or iOS's own edge-swipe back gesture.
const SWIPE_MIN_PX = 70;
const SWIPE_MAX_MS = 700;
const EDGE_GUARD_PX = 24;

function startsInHorizontalScroller(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.closest?.('input, textarea, select, [contenteditable="true"], [data-no-swipe]') === n) return true;
    if (n.scrollWidth > n.clientWidth + 4) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

function useTabSwipe(activeIndex) {
  const navigate = useNavigate();
  useEffect(() => {
    if (activeIndex < 0) return;
    let start = null;
    const onStart = (e) => {
      if (e.touches.length !== 1) { start = null; return; }
      const t = e.touches[0];
      if (t.clientX < EDGE_GUARD_PX || t.clientX > window.innerWidth - EDGE_GUARD_PX) { start = null; return; }
      if (startsInHorizontalScroller(e.target) || document.querySelector('[role="dialog"]')) { start = null; return; }
      start = { x: t.clientX, y: t.clientY, at: Date.now() };
    };
    const onEnd = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const quick = Date.now() - start.at < SWIPE_MAX_MS;
      start = null;
      if (!quick || Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      const next = activeIndex + (dx < 0 ? 1 : -1);
      if (next < 0 || next >= ITEMS.length) return;
      navigate(ITEMS[next].to, { state: { swipeDir: dx < 0 ? 'left' : 'right' } });
    };
    const onCancel = () => { start = null; };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [activeIndex, navigate]);
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const activeIndex = ITEMS.findIndex(i => i.to === pathname || (i.to === '/portal/dashboard' && pathname === '/portal'));
  useTabSwipe(activeIndex);

  // A lightweight poll (count only, no photos) so a pending connect request
  // shows up as a dot on the Chat tab without having to open it first —
  // green rather than the OS-level red badge convention, so it doesn't read
  // as an error/alert.
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const check = () => api.get('/connections/pending-count').then(res => setPendingCount(res.data.count || 0)).catch(() => {});
    check();
    const poll = setInterval(check, 30000);
    return () => clearInterval(poll);
  }, []);

  // Floating glass pill (iOS dock style): hovers above the screen edge,
  // frosted so whatever scrolls underneath shows softly through it, with the
  // active tab as a solid plum disc and the rest sitting back.
  return (
    <nav
      className="nav-glass fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2.5 rounded-full"
      style={{ bottom: 'var(--nav-bottom)', height: 'var(--nav-h)' }}
    >
      {ITEMS.map((item, i) => {
        const Icon = item.icon;
        const active = i === activeIndex;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={`relative w-[62px] h-[46px] rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
              active ? 'bg-[#754471] text-[#F5EDD8] shadow-[0_4px_12px_rgba(117,68,113,0.35)]' : 'text-navy/55 hover:text-navy/75'
            }`}
          >
            <span className="relative">
              <Icon size={25} strokeWidth={active ? 2 : 1.7} />
              {item.to === '/portal/chat' && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#F0EAD6]" />
              )}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
