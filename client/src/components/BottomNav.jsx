import React from 'react';
import { NavLink } from 'react-router-dom';

// Order matters — Home stays dead center, Group Chat/My Album to its left,
// Chat/Edit Profile to its right, per the requested layout.
const ITEMS = [
  { to: '/portal/album', icon: '📸', label: 'Album' },
  { to: '/portal/group-chat', icon: '👥', label: 'Group' },
  { to: '/portal/dashboard', icon: '🏠', label: 'Home' },
  { to: '/portal/chat', icon: '💬', label: 'Chat' },
  { to: '/portal/profile', icon: '👤', label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-[#16181d]/95 backdrop-blur">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
        {ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive ? 'text-gold' : 'text-cream/40 hover:text-cream/70'
              }`
            }
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="font-sans text-[10px] tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
