import { useContext, useEffect, useRef } from 'react';
import { PeekContext } from '../components/TabSwipe';

// setInterval for background refreshes that doesn't burn the database while
// nobody is looking: ticks only while the app is on screen, catches up once
// when it comes back after a gap, and stays silent inside the live preview of
// a neighbouring tab (the real screen will poll once it is actually shown).
export function usePolling(fn, ms) {
  const peeking = useContext(PeekContext);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (peeking) return undefined;
    let timer = null;
    let last = Date.now();
    const run = () => {
      last = Date.now();
      try { Promise.resolve(fnRef.current()).catch(() => {}); } catch { /* ignore */ }
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(() => { if (document.visibilityState === 'visible') run(); }, ms);
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - last >= ms) run();
        start();
      } else {
        stop();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, peeking]);
}
