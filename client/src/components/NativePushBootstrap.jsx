import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { subscribeToPush, linkStoredPushToken } from '../utils/push';
import { success as hapticSuccess } from '../utils/haptics';

// Runs once for the whole native app, signed in or not:
//  - first launch: asks for notification permission and registers the device
//    (as a guest if nobody's signed in — so announcements from the admin panel
//    reach people before they've even made an account)
//  - after login: attaches that same device to the account
//  - shows a notification that arrives while the app is open, and opens the
//    right screen when one is tapped
export default function NativePushBootstrap() {
  const { attendeeUser, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let handles = [];
    let cancelled = false;
    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const received = await PushNotifications.addListener('pushNotificationReceived', (n) => {
          toast(`${n.title ? `${n.title} — ` : ''}${n.body || ''}`, { icon: '🔔', duration: 5000 });
          hapticSuccess();
        });
        const tapped = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = action?.notification?.data?.url;
          // Tells the resume-to-dashboard handler not to override this.
          window.__heyderNotifTapAt = Date.now();
          if (typeof url === 'string' && url.startsWith('/')) navigate(url);
          else if (typeof url === 'string' && url.startsWith('https://')) window.open(url, '_blank');
        });
        if (cancelled) { received.remove(); tapped.remove(); } else handles = [received, tapped];
      } catch { /* plugin not in this build */ }
    })();
    return () => { cancelled = true; handles.forEach((h) => h.remove()); };
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || loading) return undefined;
    // A short pause so the permission dialog doesn't land on top of the very
    // first screen before it has even drawn.
    const t = setTimeout(async () => {
      // Keyed on whether this device actually registered, not on whether we
      // ever asked. "Asked once, never again" left every phone that had
      // already run an older build (where registration silently failed on
      // iPhone) permanently unregistered, since the flag was set before the
      // attempt even finished. Retrying is harmless otherwise: iOS only shows
      // the permission dialog once, and a denied answer returns immediately.
      localStorage.setItem('heyder_push_asked', '1');
      if (localStorage.getItem('heyder_fcm_registered') === 'true') {
        await linkStoredPushToken();
      } else {
        const result = await subscribeToPush();
        // Registration used to fail with no sign at all on iPhone. Say so,
        // with the reason, instead — but not for "denied" (the user's own
        // choice) and only on iOS, where this is the new path.
        if (result?.error && result.error !== 'denied' && Capacitor.getPlatform() === 'ios') {
          toast.error(`Notifications couldn't be turned on: ${result.detail || result.error}`, { duration: 9000 });
        }
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [loading, attendeeUser?.uid]);

  return null;
}
