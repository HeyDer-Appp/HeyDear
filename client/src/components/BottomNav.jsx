import React, { useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { Image, Users, MessageCircle } from 'lucide-react';
import api from '../utils/api';
import { PeekContext } from './TabSwipe';
import { usePolling } from '../utils/usePolling';

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

// One shared, throttled fetch: every tab screen mounts its own BottomNav (and
// a swipe mounts a second one for the peeking tab), so without this each
// switch would fire its own request at the rate-limited API.
let sharedCount = 0;
let lastFetchAt = 0;
const listeners = new Set();
function refreshPendingCount() {
  if (Date.now() - lastFetchAt < 20000) return;
  lastFetchAt = Date.now();
  api.get('/connections/pending-count')
    .then(res => { sharedCount = res.data.count || 0; listeners.forEach(fn => fn(sharedCount)); })
    .catch(() => {});
}

export default function BottomNav({ style }) {
  const peeking = useContext(PeekContext);
  const { pathname } = useLocation();
  const activeIndex = ITEMS.findIndex(i => i.to === pathname || (i.to === '/portal/dashboard' && pathname === '/portal') || (i.to === '/portal/chat' && pathname.startsWith('/portal/dm/')));

  // A lightweight poll (count only, no photos) so a pending connect request
  // shows up as a dot on the Chat tab without having to open it first —
  // green rather than the OS-level red badge convention, so it doesn't read
  // as an error/alert.
  const [pendingCount, setPendingCount] = useState(sharedCount);

  useEffect(() => {
    listeners.add(setPendingCount);
    refreshPendingCount();
    return () => { listeners.delete(setPendingCount); };
  }, []);
  usePolling(refreshPendingCount, 30000);

  // Floating glass pill (iOS dock style): hovers above the screen edge,
  // frosted so whatever scrolls underneath shows softly through it, with the
  // active tab as a solid plum disc and the rest sitting back.
  if (peeking) return null;

  // Portalled to <body> so no page's stacking context (or the tab slide) can
  // ever clip or cover it.
  return createPortal(
    <nav
      className="nav-glass fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2.5 rounded-full"
      style={{ bottom: 'var(--nav-bottom)', height: 'var(--nav-h)', ...style }}
    >
      {/* The plum disc is one element that glides to the active tab. */}
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-[#754471] shadow-[0_4px_12px_rgba(117,68,113,0.35)] pointer-events-none"
        style={{
          left: 10, top: 9, width: 62, height: 46,
          opacity: activeIndex >= 0 ? 1 : 0,
          transform: `translateX(${Math.max(activeIndex, 0) * 68}px)`,
          transition: 'transform 300ms cubic-bezier(0.22, 0.9, 0.3, 1), opacity 200ms',
        }}
      />
      {ITEMS.map((item, i) => {
        const Icon = item.icon;
        const active = i === activeIndex;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={`relative w-[62px] h-[46px] rounded-full flex items-center justify-center transition-colors duration-200 active:scale-90 ${
              active ? 'text-[#F5EDD8]' : 'text-navy/55 hover:text-navy/75'
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
    </nav>,
    document.body
  );
}
