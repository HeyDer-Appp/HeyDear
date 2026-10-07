import React, { createContext, startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// True inside the live preview of the neighbouring tab (BottomNav renders
// nothing there — the one real nav pill stays put above the slide).
export const PeekContext = createContext(false);

// Tab order, left to right — must match BottomNav's ITEMS.
export const TAB_PATHS = ['/portal/album', '/portal/group-chat', '/portal/dashboard', '/portal/chat'];
export const tabIndexOf = (pathname) => (pathname === '/portal' ? 2 : TAB_PATHS.indexOf(pathname));

const LOCK_PX = 10;          // movement before we decide horizontal vs vertical
const EDGE_GUARD_PX = 24;    // leave iOS's own edge-swipe-back alone
const COMMIT_FRACTION = 0.3; // dragged this far (of screen width) → commit
const FLICK_PX_PER_MS = 0.4; // …or released faster than this
const RUBBER_BAND = 0.25;    // resistance past the first/last tab
const SETTLE_MS = 260;

// Instagram-style tab pager. The screen follows the finger 1:1, the
// neighbouring tab slides in beside it (rendered live via `renderPeek`), and
// on release it either snaps to the neighbour (past a third of the screen, or
// a quick flick) or springs back. The map background and the nav pill stay
// put while the content slides over them.
//
// Only the *content* of each page moves: CSS (index.css, ".tab-pager-*")
// translates the direct children of each .portal-bg root, so position:fixed
// layers (map, nav) keep their place.
export default function TabSwipe({ pathname, renderPeek, children }) {
  const navigate = useNavigate();
  const index = tabIndexOf(pathname);
  const curRef = useRef(null);
  const nbRef = useRef(null);
  const [peekPath, setPeekPath] = useState(null);
  const s = useRef({ mode: 'idle', px: 0, peek: null, samples: [] });

  const apply = (px) => {
    const st = s.current;
    st.px = px;
    const cur = curRef.current;
    if (cur) {
      cur.classList.add('is-dragging');
      cur.style.setProperty('--px', `${px}px`);
    }
    const nb = nbRef.current;
    if (nb) {
      // The whole neighbour layer slides as one GPU-composited transform; its
      // map counter-translates in CSS so it stays put on screen (no clip-path,
      // which would repaint every frame).
      const W = window.innerWidth;
      nb.style.setProperty('--wx', `${px < 0 ? W + px : -W + px}px`);
    }
  };

  const cleanup = () => {
    const st = s.current;
    st.mode = 'idle';
    st.px = 0;
    st.peek = null;
    st.samples = [];
    const cur = curRef.current;
    if (cur) {
      cur.classList.remove('is-dragging', 'is-settling');
      cur.style.removeProperty('--px');
    }
    setPeekPath(null);
  };

  // The peek page mounts a render after the first move; position it as soon
  // as it exists so it never flashes at its resting place.
  useLayoutEffect(() => {
    if (peekPath && nbRef.current) apply(s.current.px);
  }, [peekPath]);

  // New route committed (or changed some other way): drop all drag state in
  // the same paint as the new page appears.
  useLayoutEffect(() => { cleanup(); }, [pathname]);

  useEffect(() => {
    if (index < 0) return undefined;

    const blocked = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches?.('input, textarea, select, [contenteditable="true"], [data-no-swipe], [role="dialog"], .nav-glass')) return true;
        const cs = getComputedStyle(n);
        if (cs.position === 'fixed') return true; // modals, composers, the nav
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;
      }
      return false;
    };

    const onStart = (e) => {
      const st = s.current;
      if (st.mode === 'settling') return;
      st.mode = 'idle';
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX < EDGE_GUARD_PX || t.clientX > window.innerWidth - EDGE_GUARD_PX) return;
      if (blocked(e.target)) return;
      st.mode = 'pending';
      st.x0 = t.clientX;
      st.y0 = t.clientY;
      st.slop = 0;
      st.samples = [{ x: t.clientX, t: performance.now() }];
    };

    const onMove = (e) => {
      const st = s.current;
      if (st.mode !== 'pending' && st.mode !== 'drag') return;
      if (e.touches.length !== 1) { if (st.mode === 'drag') settle(false); else st.mode = 'idle'; return; }
      const t = e.touches[0];
      const dx = t.clientX - st.x0;
      const dy = t.clientY - st.y0;

      if (st.mode === 'pending') {
        if (Math.abs(dy) >= LOCK_PX && Math.abs(dy) > Math.abs(dx)) { st.mode = 'ignore'; return; }
        if (Math.abs(dx) >= LOCK_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
          st.mode = 'drag';
          st.slop = Math.sign(dx) * LOCK_PX; // start from 0 so the page doesn't jump
        } else return;
      }

      // No preventDefault: .tab-pager-current is touch-action: pan-y, so the browser
      // never pans sideways, and a passive listener keeps vertical scrolling smooth.
      const raw = dx - st.slop;
      const dir = raw < 0 ? 1 : -1;
      const next = index + dir;
      const has = next >= 0 && next < TAB_PATHS.length;
      // Mounting the neighbour is heavy; as a transition it yields to the drag
      // instead of freezing the first frames.
      if (has && st.peek !== TAB_PATHS[next]) { const p = TAB_PATHS[next]; st.peek = p; startTransition(() => setPeekPath(p)); }
      if (!has && st.peek) { st.peek = null; setPeekPath(null); }
      st.samples.push({ x: t.clientX, t: performance.now() });
      if (st.samples.length > 6) st.samples.shift();
      apply(has ? raw : raw * RUBBER_BAND);
    };

    const settle = (commit) => {
      const st = s.current;
      st.mode = 'settling';
      const W = window.innerWidth;
      const target = commit ? (st.px < 0 ? -W : W) : 0;
      curRef.current?.classList.add('is-settling');
      nbRef.current?.classList.add('is-settling');
      apply(target);
      const to = st.peek;
      setTimeout(() => {
        if (commit && to) navigate(to, { state: { swiped: true } });
        else cleanup();
      }, SETTLE_MS + 20);
    };

    const onEnd = () => {
      const st = s.current;
      if (st.mode !== 'drag') { st.mode = 'idle'; return; }
      const W = window.innerWidth;
      const a = st.samples[0];
      const b = st.samples[st.samples.length - 1];
      const v = b && a && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
      const sameWay = Math.sign(v) === Math.sign(st.px);
      const commit = !!st.peek && (Math.abs(st.px) > W * COMMIT_FRACTION || (Math.abs(v) > FLICK_PX_PER_MS && sameWay));
      settle(commit);
    };

    const onCancel = () => { if (s.current.mode === 'drag') settle(false); else s.current.mode = 'idle'; };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [index, navigate]);

  return (
    <>
      <div ref={curRef} className="tab-pager-current">{children}</div>
      {peekPath && (
        <div ref={nbRef} className="tab-pager-neighbour" aria-hidden="true">
          <PeekContext.Provider value={true}>
            {renderPeek({ pathname: peekPath, search: '', hash: '', state: null, key: 'swipe-peek' })}
          </PeekContext.Provider>
        </div>
      )}
    </>
  );
}
