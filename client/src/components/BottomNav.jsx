import React from 'react';
import { NavLink } from 'react-router-dom';
import { Image, Users, MessageCircle, User } from 'lucide-react';

// The Home slot as a mini version of the HeyDer logo mark — same bracket
// (top bar + inset legs overhanging at the corners), with "My Table" set
// inside it instead of "HeyDer". Text is baked into the SVG, so this item
// skips the usual caption underneath.
function MyTableIcon() {
  return (
    <svg width="82" height="30" viewBox="0 0 82 30" fill="none">
      <path d="M2 4h78" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M10 4v24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M72 4v24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <text x="41" y="19" textAnchor="middle" fontFamily="sans-serif" fontWeight="800" fontSize="12.5" fill="currentColor" letterSpacing="-0.3">My Table</text>
    </svg>
  );
}

// Order matters — Home stays dead center, Group Chat/My Album to its left,
// Chat/Edit Profile to its right, per the requested layout.
const ITEMS = [
  { to: '/portal/album', icon: Image, label: 'Album' },
  { to: '/portal/group-chat', icon: Users, label: 'Group' },
  { to: '/portal/dashboard', icon: MyTableIcon, label: 'My Table', noCaption: true },
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
              {!item.noCaption && (
                <span className="font-sans text-[10px] tracking-wide">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
