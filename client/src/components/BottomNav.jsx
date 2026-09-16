import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Image, Users, MessageCircle, User } from 'lucide-react';
import api from '../utils/api';

// Fork, plate, spoon — traced from a reference icon, filled solid instead
// of outlined like the other four nav icons. currentColor so it still
// tints gold on the active tab.
function PlateForkSpoonIcon() {
  return (
    <svg width="33" height="27" viewBox="0 0 30 24" fill="currentColor">
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

// Order matters — Home stays dead center, Group Chat/My Album to its left,
// Chat/Edit Profile to its right, per the requested layout.
const ITEMS = [
  { to: '/portal/album', icon: Image, label: 'Album' },
  { to: '/portal/group-chat', icon: Users, label: 'Group' },
  { to: '/portal/dashboard', icon: PlateForkSpoonIcon, label: 'My Table' },
  { to: '/portal/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/portal/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
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

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-md" style={{ background: 'transparent' }}>
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
        {ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-[#754471]' : 'text-gray-500/70 hover:text-gray-500'
                }`
              }
            >
              <span className="relative">
                <Icon size={27} strokeWidth={1.75} />
                {item.to === '/portal/chat' && pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#E7DFC5]" />
                )}
              </span>
              <span className="font-sans text-[11px] tracking-wide">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
