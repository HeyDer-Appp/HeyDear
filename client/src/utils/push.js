import api from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
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
