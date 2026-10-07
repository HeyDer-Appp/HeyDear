import React from 'react';
import ProfileAvatar from './ProfileAvatar';

// Top bar for the tab screens (Album, Groups, Connections): the page's own
// heading sits exactly where the HeyDer logo sits on My Table — same left
// edge, same row, same size — with the profile photo on the right.
// `doodle` puts the heading on a cream plate so it stays readable over the
// doodle wallpaper.
export default function TabHeader({ title, doodle = false }) {
  return (
    <nav
      className="relative z-10 flex items-center justify-between px-6 pb-5"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <h1
        className={`font-serif font-bold text-[28px] leading-7 text-navy whitespace-nowrap ${doodle ? 'doodle-label' : ''}`}
        // The plate's own padding is pulled back so the text itself starts at the logo's left edge.
        style={doodle ? { padding: '0.1em 0.6em', marginLeft: '-0.6em' } : undefined}
      >
        {title}
      </h1>
      <ProfileAvatar />
    </nav>
  );
}
