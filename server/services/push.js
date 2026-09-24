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

// ── Audiences & campaigns (marketing-style notifications set from the admin panel) ──
//
// A device can be subscribed without anyone being signed in (userId null —
// e.g. someone who installed the app and never made an account), so the
// admin can reach people before they sign up as well as after.
const AUDIENCES = [
  { id: 'all', label: 'Everyone (every device)' },
  { id: 'guests', label: 'Not signed up yet' },
  { id: 'signed_up', label: 'Signed up (has an account)' },
  { id: 'no_profile', label: 'Signed up, profile not finished' },
  { id: 'no_booking', label: 'Profile done, no dinner booked' },
  { id: 'booked', label: 'Has a dinner booked' },
  { id: 'members', label: 'Monthly members' },
];

function todayKeyNz() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

async function loadSegmentSets() {
  const nowMs = Date.now();
  const [usersSnap, bookingsSnap, subsSnap] = await Promise.all([
    db.collection('users').select('profileComplete').get(),
    db.collection('bookings').where('tuesdayDate', '>=', todayKeyNz()).get(),
    db.collection('subscriptions').where('status', 'in', ['active', 'trialing']).get(),
  ]);
  const profileComplete = new Set();
  usersSnap.docs.forEach((d) => { if (d.data().profileComplete) profileComplete.add(d.id); });
  const booked = new Set();
  bookingsSnap.docs.forEach((d) => { const b = d.data(); if (b.paid !== false && b.userId) booked.add(b.userId); });
  const members = new Set();
  subsSnap.docs.forEach((d) => {
    const s = d.data();
    const end = s.currentPeriodEnd?.toMillis?.() || 0;
    if (s.userId && end > nowMs) members.add(s.userId);
  });
  return { profileComplete, booked, members };
}

function inAudience(audience, sub, sets) {
  const uid = sub.userId || null;
  switch (audience) {
    case 'all': return true;
    case 'guests': return !uid;
    case 'signed_up': return !!uid;
    case 'no_profile': return !!uid && !sets.profileComplete.has(uid);
    case 'no_booking': return !!uid && sets.profileComplete.has(uid) && !sets.booked.has(uid);
    case 'booked': return !!uid && sets.booked.has(uid);
    case 'members': return !!uid && sets.members.has(uid);
    default: return false;
  }
}

async function resolveAudience(audience) {
  const [snap, sets] = await Promise.all([db.collection('pushSubscriptions').get(), loadSegmentSets()]);
  return snap.docs.map((d) => d.data()).filter((sub) => inAudience(audience, sub, sets));
}

async function audienceCounts() {
  const [snap, sets] = await Promise.all([db.collection('pushSubscriptions').get(), loadSegmentSets()]);
  const subs = snap.docs.map((d) => d.data());
  return AUDIENCES.map((a) => ({ ...a, count: subs.filter((s) => inAudience(a.id, s, sets)).length }));
}

async function sendToAudience(audience, payload) {
  const docs = await resolveAudience(audience);
  const sent = await sendToDocs(docs, payload);
  return { target: docs.length, sent };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Called every few minutes by the scheduler: sends any campaign whose time
// has come; a weekly one re-arms itself for the same time next week.
async function runDueCampaigns() {
  const snap = await db.collection('pushCampaigns').where('status', '==', 'scheduled').get();
  const now = Date.now();
  for (const doc of snap.docs) {
    const c = doc.data();
    const due = c.scheduledAt?.toMillis?.() || 0;
    if (!due || due > now) continue;

    // Claim it first so a slow send can't be picked up twice by the next tick.
    await doc.ref.set({ status: 'sending' }, { merge: true });
    try {
      const payload = notifications.custom(c.title, c.body, c.url || '/');
      const { target, sent } = await sendToAudience(c.audience, payload);
      const base = { lastSentAt: admin.firestore.FieldValue.serverTimestamp(), sentCount: sent, targetCount: target, runCount: (c.runCount || 0) + 1 };
      if (c.repeat === 'weekly') {
        let next = due + 7 * DAY_MS;
        while (next <= now) next += 7 * DAY_MS;
        await doc.ref.set({ ...base, status: 'scheduled', scheduledAt: admin.firestore.Timestamp.fromMillis(next) }, { merge: true });
      } else {
        await doc.ref.set({ ...base, status: 'sent' }, { merge: true });
      }
    } catch (err) {
      console.error('campaign failed', doc.id, err.message);
      await doc.ref.set({ status: 'failed', error: String(err.message).slice(0, 200) }, { merge: true });
    }
  }
}

module.exports = {
  init, sendToUser, sendToTable, sendToAll, sendToSubscription, sendToFcmToken, notifications, endpointKey,
  AUDIENCES, audienceCounts, sendToAudience, runDueCampaigns,
};
