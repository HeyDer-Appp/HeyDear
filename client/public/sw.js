const CACHE_NAME = 'heyder-v1';
const OFFLINE_URL = '/offline.html';

// Routes to cache for offline use
const PRECACHE = ['/', '/quiz', '/portal/login', '/about'];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (network-first, cache fallback) ────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return; // Never cache API calls

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'HeyDer', body: event.data.text(), url: '/' };
  }

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image || undefined,
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'heyder-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: false,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'HeyDer', options)
  );
});

// ── Notification click → open/focus app ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const actionUrl = event.action ? getActionUrl(event.action, event.notification.data) : targetUrl;
  const finalUrl = new URL(actionUrl, self.registration.scope).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If app is already open, focus it and navigate to the right screen
        for (const client of windowClients) {
          if (client.url.startsWith(self.registration.scope)) {
            client.focus();
            client.navigate(finalUrl);
            return;
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(finalUrl);
      })
  );
});

// ── Notification close tracking ───────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  // Could send analytics here
});

// ── Push subscription change ──────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: event.oldSubscription?.options?.applicationServerKey })
      .then((newSubscription) => {
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            old_endpoint: event.oldSubscription?.endpoint,
            subscription: newSubscription,
          }),
        });
      })
  );
});

function getActionUrl(action, data) {
  const map = {
    'view_dinner': '/portal',
    'view_venue': '/portal',
    'give_feedback': `/feedback/${data?.dinnerId || ''}`,
    'open_app': '/',
  };
  return map[action] || data?.url || '/';
}
