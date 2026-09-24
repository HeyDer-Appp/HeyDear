import React, { useEffect, useRef, useState } from 'react';
import { tap, success } from '../utils/haptics';

const THRESHOLD = 70;

// Android's WebView has no pull-to-refresh of its own. Pull down from the top
// of any signed-in screen and every list on it quietly re-fetches (each
// screen already listens for the 'heyder:refresh' event — see useCachedFetch).
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const armed = useRef(false);

  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30000) { hiddenAt = 0; window.dispatchEvent(new Event('heyder:refresh')); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const onStart = (e) => {
      // Only from the very top, and never inside a scrolling panel/modal.
      if (window.scrollY > 0 || e.target.closest?.('[data-no-ptr], textarea, input, select')) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
      armed.current = false;
    };
    const onMove = (e) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setPull(0); return; }
      const eased = Math.min(110, dy * 0.5);
      setPull(eased);
      if (eased >= THRESHOLD && !armed.current) { armed.current = true; tap(); }
      if (eased < THRESHOLD) armed.current = false;
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (armed.current) {
        setRefreshing(true);
        setPull(THRESHOLD);
        window.dispatchEvent(new Event('heyder:refresh'));
        setTimeout(() => { setRefreshing(false); setPull(0); success(); }, 900);
      } else {
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [refreshing]);

  if (pull <= 0 && !refreshing) return null;
  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: 0, transform: `translateY(${Math.max(0, pull - 36)}px)`, transition: refreshing ? 'transform .2s' : 'none' }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'rgba(245,237,216,0.95)', border: '1px solid rgba(22,24,29,0.12)' }}>
        <div
          className={`w-4 h-4 rounded-full border-2 border-plum border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
        />
      </div>
    </div>
  );
}
