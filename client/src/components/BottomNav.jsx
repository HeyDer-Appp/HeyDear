import React from 'react';
import { NavLink } from 'react-router-dom';
import { Image, Users, MessageCircle, User } from 'lucide-react';

// A dinner-plate-with-cutlery glyph for Home — lucide doesn't ship one.
// Fork and knife sit fully inside the plate rim rather than overhanging it,
// which reads more clearly as "plate" at 22px than a full-height overlay does.
function DinnerPlateIcon({ size = 22, strokeWidth = 1.75 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7 5v3M8.5 5v3M10 5v3" />
      <path d="M7 8c0 1.5 1 2.5 1.75 2.5S10.5 9.5 10.5 8" />
      <path d="M8.75 10.5v7" />
      <path d="M15.5 5c1.5 0 2.5 1.5 2.5 3.5S17 12 15.5 12" />
      <path d="M15.5 12v5.5" />
    </svg>
  );
}

// Order matters — Home stays dead center, Group Chat/My Album to its left,
// Chat/Edit Profile to its right, per the requested layout.
const ITEMS = [
  { to: '/portal/album', icon: Image, label: 'Album' },
  { to: '/portal/group-chat', icon: Users, label: 'Group' },
  { to: '/portal/dashboard', icon: DinnerPlateIcon, label: 'Home' },
  { to: '/portal/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/portal/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-[#16181d]/95 backdrop-blur">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
        {ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive ? 'text-gold' : 'text-cream/40 hover:text-cream/70'
                }`
              }
            >
              <Icon size={22} strokeWidth={1.75} />
              <span className="font-sans text-[10px] tracking-wide">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
