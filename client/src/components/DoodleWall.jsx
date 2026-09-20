import React, { useEffect, useRef } from 'react';

// How much of the page's scroll distance the doodles travel — well under 1,
// so they lag behind the content and read as a slower, deeper layer.
const PARALLAX = 0.2;

// Full-page doodle wallpaper behind a screen's content. Fixed to the
// viewport (like the map on .portal-bg) so it never affects layout or taps.
// `still` freezes it (used behind the chat, where the feed scrolls on its own).
// Two motions stack: the outer layer follows the page scroll at a fraction
// of its speed, the inner one drifts up and down on its own very slowly.
export default function DoodleWall({ still = false }) {
  const layer = useRef(null);

  useEffect(() => {
    if (still) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (layer.current) layer.current.style.transform = `translate3d(0, ${-window.scrollY * PARALLAX}px, 0)`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <div className="doodle-wall" aria-hidden="true">
      <div ref={layer} className="doodle-wall-layer">
        <div className={`doodle-wall-drift${still ? ' doodle-wall-still' : ''}`} />
      </div>
    </div>
  );
}
