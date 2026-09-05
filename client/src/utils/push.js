import api from './api';
import { Capacitor } from '@capacitor/core';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  // Capacitor's Android WebView has no PushManager at all — native push
  // goes through FCM instead (see subscribeToPush's native branch below).
  if (Capacitor.isNativePlatform()) return true;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState() {
  if (Capacitor.isNativePlatform()) {
    // Native permission checks are async, but callers here need a sync
    // read — this flag is set once we've successfully registered an FCM
    // token, so a returning user with notifications already on doesn't
    // get re-prompted every session.
    return localStorage.getItem('heyder_fcm_registered') === 'true' ? 'granted' : 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

async function subscribeToPushNative(userId) {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') return { error: 'denied' };

  return new Promise((resolve) => {
    let settled = false;
    PushNotifications.addListener('registration', async (token) => {
      if (settled) return;
      settled = true;
      try {
        await api.post('/push/register-fcm', { userId, fcmToken: token.value });
        localStorage.setItem('heyder_fcm_registered', 'true');
        resolve({ success: true });
      } catch (err) {
        console.error('FCM token registration failed:', err);
        resolve({ error: 'subscribe_failed' });
      }
    });
    PushNotifications.addListener('registrationError', (err) => {
      if (settled) return;
      settled = true;
      console.error('FCM registration failed:', err);
      resolve({ error: 'subscribe_failed' });
    });
    PushNotifications.register();
  });
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { error: 'not_supported' };
  if (Capacitor.isNativePlatform()) return subscribeToPushNative(userId);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'denied' };

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { error: 'no_vapid_key' };

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Send subscription to backend
    await api.post('/push/subscribe', {
      userId,
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    });

    return { success: true, subscription };
  } catch (err) {
    console.error('Push subscribe failed:', err);
    return { error: 'subscribe_failed' };
  }
}

export async function unsubscribeFromPush(userId) {
  if (Capacitor.isNativePlatform()) {
    localStorage.removeItem('heyder_fcm_registered');
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    await api.post('/push/unsubscribe', {
      userId,
      endpoint: subscription.endpoint,
    }).catch(() => {});
  }
}
