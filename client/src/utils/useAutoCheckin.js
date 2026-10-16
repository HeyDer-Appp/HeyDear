import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import api from './api';
import { success } from './haptics';

const RETRY_MS = 30000;

// Marks a diner as arrived without them touching anything: while the check-in
// window is open, the phone's position is sent to the server every half minute
// and the server decides whether it's within ~150 m of the restaurant. Stops as
// soon as it works. Needs the app to be open; if location is switched off it
// reports that so the card can say so.
//
// Returns { status }: 'idle' (not time yet / nothing to do) · 'checking' ·
// 'done' · 'denied' (location permission refused) · 'unavailable'.
export default function useAutoCheckin({ tableId, checkin, open, onDone }) {
  const [status, setStatus] = useState(checkin?.done ? 'done' : 'idle');
  const stopped = useRef(false);

  const active = !!(checkin && checkin.enabled && open && !checkin.done && tableId);

  useEffect(() => {
    if (checkin?.done) setStatus('done');
  }, [checkin?.done]);

  useEffect(() => {
    if (!active) return undefined;
    stopped.current = false;
    let timer = null;

    const attempt = async () => {
      if (stopped.current) return;
      try {
        if (Capacitor.isNativePlatform()) {
          let perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') perm = await Geolocation.requestPermissions();
          if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') { setStatus('denied'); return schedule(); }
        }
        setStatus((s) => (s === 'done' ? s : 'checking'));
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
        if (stopped.current) return;
        const res = await api.post(`/portal/checkin/${tableId}`, {
          lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy,
        });
        if (res.data.checkedIn) {
          stopped.current = true;
          setStatus('done');
          success();
          onDone?.(tableId);
          return;
        }
        if (res.data.reason === 'outside_window') { stopped.current = true; setStatus('idle'); return; }
      } catch (e) {
        // PERMISSION_DENIED (1) from the browser, or the plugin's own message.
        const denied = e && (e.code === 1 || /denied|permission/i.test(e.message || ''));
        setStatus(denied ? 'denied' : 'unavailable');
      }
      schedule();
    };
    const schedule = () => { if (!stopped.current) timer = setTimeout(attempt, RETRY_MS); };

    attempt();
    // Coming back to the app mid-dinner: check straight away rather than wait.
    const onVisible = () => { if (document.visibilityState === 'visible' && !stopped.current) { clearTimeout(timer); attempt(); } };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped.current = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tableId]);

  return { status };
}
