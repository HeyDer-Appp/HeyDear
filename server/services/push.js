const webpush = require('web-push');
const crypto = require('crypto');
const { admin, db, messaging } = require('../firebase');

function endpointKey(endpoint) {
  return crypto.createHash('sha1').update(endpoint).digest('hex');
}

function init() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not set — push notifications disabled. Run: npx web-push generate-vapid-keys');
    return false;
  }
  webpush.setVapidDetails(
    'mailto:info@heyder.nz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

// Send to a single subscription object
async function sendToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { sent: true };
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — clean it up
      await db.collection('pushSubscriptions').doc(endpointKey(subscription.endpoint)).delete().catch(() => {});
      return { sent: false, expired: true };
    }
    throw err;
  }
}

// Send to a single native (Android/FCM) token — separate path from web-push
// since Capacitor's Android WebView has no PushManager to hold a web
// subscription at all.
async function sendToFcmToken(fcmToken, payload) {
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url || '/', tag: payload.tag || '' },
    });
    return { sent: true };
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-argument') {
      // Token expired/uninstalled — clean it up
      await db.collection('pushSubscriptions').doc(endpointKey(fcmToken)).delete().catch(() => {});
      return { sent: false, expired: true };
    }
    throw err;
  }
}

async function sendToDocs(docs, payload) {
  const results = await Promise.allSettled(
    docs.map((data) =>
      data.type === 'fcm'
        ? sendToFcmToken(data.fcmToken, payload)
        : sendToSubscription(
            { endpoint: data.endpoint, keys: { p256dh: data.p256dh, auth: data.auth } },
            payload
          )
    )
  );
  return results.filter((r) => r.status === 'fulfilled' && r.value.sent).length;
}

// Send to a specific user (all their devices)
async function sendToUser(userId, payload) {
  const snap = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
  return sendToDocs(snap.docs.map(d => d.data()), payload);
}

// Send to all users seated at a table — tableMembers is a top-level
// collection filtered by tableId, not a subcollection under the table doc
// (this previously queried tables/{id}/members, which never existed, so
// every "table" push silently sent to nobody).
async function sendToTable(tableId, payload, { excludeUserId } = {}) {
  const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
  const userIds = [...new Set(membersSnap.docs.map(d => d.data().user_id).filter(Boolean))]
    .filter(id => id !== excludeUserId);
  if (!userIds.length) return 0;

  const snap = await db.collection('pushSubscriptions').where('userId', 'in', userIds.slice(0, 30)).get();
  return sendToDocs(snap.docs.map(d => d.data()), payload);
}

// Send to all subscribers (broadcast)
async function sendToAll(payload) {
  const snap = await db.collection('pushSubscriptions').get();
  return sendToDocs(snap.docs.map(d => d.data()), payload);
}

// Pre-built notification payloads
const notifications = {
  findGroupReminder: () => ({
    title: 'Just 3 more days 👀',
    body: "We're still finding your group for Tuesday's dinner — hang tight, you'll hear from us soon.",
    url: '/portal',
    tag: 'find-group-reminder',
    requireInteraction: false,
  }),

  groupFound: (dinnerDate) => ({
    title: 'Your group is ready 🎉',
    body: `Your table is set for ${dinnerDate}. Check the app for details.`,
    url: '/portal',
    tag: 'group-found',
    requireInteraction: true,
    actions: [{ action: 'view_dinner', title: 'See my group' }],
  }),

  glimpse: (dinnerDate) => ({
    title: 'A glimpse of your table 👀',
    body: `Dinner is in 48 hours. Tap to see who you're meeting.`,
    url: '/portal',
    tag: 'glimpse',
    requireInteraction: false,
    actions: [{ action: 'view_dinner', title: 'See the glimpse' }],
  }),

  venueReveal: (restaurantName) => ({
    title: `Tonight's venue is revealed 📍`,
    body: `Head to ${restaurantName} at 7pm. Tap for full details.`,
    url: '/portal',
    tag: 'venue-reveal',
    requireInteraction: true,
    actions: [
      { action: 'view_venue', title: 'Get directions' },
    ],
  }),

  rsvpPrompt: () => ({
    title: 'Still coming tonight? 🍽️',
    body: 'Dinner starts at 7pm — open the app to confirm.',
    url: '/portal',
    tag: 'rsvp-prompt',
    requireInteraction: true,
    actions: [{ action: 'view_dinner', title: 'Confirm now' }],
  }),

  reminder: (restaurantName) => ({
    title: `Dinner tonight — 7pm 🍽️`,
    body: `${restaurantName} is waiting for you. See you there.`,
    url: '/portal',
    tag: 'reminder',
    requireInteraction: false,
  }),

  feedback: () => ({
    title: 'How was last night? 💬',
    body: 'Two minutes to share your feedback — it shapes every dinner.',
    url: '/portal',
    tag: 'feedback',
    requireInteraction: false,
    actions: [{ action: 'give_feedback', title: 'Share feedback' }],
  }),

  custom: (title, body, url = '/portal') => ({
    title,
    body,
    url,
    tag: 'custom-' + Date.now(),
  }),
};

module.exports = { init, sendToUser, sendToTable, sendToAll, sendToSubscription, sendToFcmToken, notifications, endpointKey };
