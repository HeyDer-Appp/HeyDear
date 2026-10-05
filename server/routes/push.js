const express = require('express');
const router = express.Router();
const { admin, db, auth } = require('../firebase');
const { adminAuth } = require('../middleware/auth');
const pushService = require('../services/push');

// The device may be used by someone who isn't signed in (that's the point —
// guests can get notifications too), so auth is optional here. But a userId
// is only ever taken from a verified token, never from the request body:
// otherwise anyone could attach their own device to somebody else's account
// and receive that person's notifications.
async function verifiedUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = await auth.verifyIdToken(header.split(' ')[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

// Attendee subscribes their device
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;
    const userId = await verifiedUserId(req);
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await db.collection('pushSubscriptions').doc(pushService.endpointKey(subscription.endpoint)).set({
      userId: userId || null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Attendee unsubscribes
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    await db.collection('pushSubscriptions').doc(pushService.endpointKey(endpoint)).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Native app (Android/FCM) device registers its token — separate path from
// /subscribe since there's no PushManager subscription object inside
// Capacitor's WebView, just a plain token from the OS.
router.post('/register-fcm', async (req, res) => {
  try {
    const { fcmToken, anonymous } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') return res.status(400).json({ error: 'Missing fcmToken' });
    // anonymous:true is sent on logout so the next person using this device
    // isn't handed the previous account's notifications.
    const userId = anonymous ? null : await verifiedUserId(req);

    await db.collection('pushSubscriptions').doc(pushService.endpointKey(fcmToken)).set({
      userId: userId || null,
      fcmToken,
      type: 'fcm',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save FCM token' });
  }
});

// Is push set up on this server? Booleans and non-secret IDs only, so a
// "notifications aren't arriving" report can be checked without log access.
router.get('/status', (req, res) => {
  res.json({
    apns: pushService.apnsStatus(),
    webPush: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
});

// iPhone (native iOS app) registers its APNs device token. Same shape as the
// FCM route above, but stored as its own type since it goes to Apple directly.
router.post('/register-apns', async (req, res) => {
  try {
    const { apnsToken, anonymous } = req.body;
    // APNs device tokens are hex strings; reject anything else outright since
    // the value ends up in a URL path when sending.
    if (!apnsToken || typeof apnsToken !== 'string' || !/^[0-9a-fA-F]{32,200}$/.test(apnsToken)) {
      return res.status(400).json({ error: 'Missing or invalid apnsToken' });
    }
    const userId = anonymous ? null : await verifiedUserId(req);

    await db.collection('pushSubscriptions').doc(pushService.endpointKey(apnsToken)).set({
      userId: userId || null,
      apnsToken,
      type: 'apns',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save APNs token' });
  }
});

// Handle subscription renewal (pushsubscriptionchange in SW)
router.post('/resubscribe', async (req, res) => {
  try {
    const { old_endpoint, subscription } = req.body;
    if (old_endpoint) {
      await db.collection('pushSubscriptions').doc(pushService.endpointKey(old_endpoint)).delete();
    }
    if (subscription?.endpoint) {
      await db.collection('pushSubscriptions').doc(pushService.endpointKey(subscription.endpoint)).set({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

// Send push to a specific user
router.post('/admin/send/user/:userId', adminAuth, async (req, res) => {
  try {
    const { title, body, url, type } = req.body;
    const payload = type
      ? pushService.notifications[type]?.(...(req.body.args || []))
      : pushService.notifications.custom(title, body, url);

    if (!payload) return res.status(400).json({ error: 'Unknown notification type' });

    const sent = await pushService.sendToUser(req.params.userId, payload);
    res.json({ sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send push' });
  }
});

// Send push to all members of a table
router.post('/admin/send/table/:tableId', adminAuth, async (req, res) => {
  try {
    const { type, title, body, url } = req.body;
    const payload = type && pushService.notifications[type]
      ? pushService.notifications[type](...(req.body.args || []))
      : pushService.notifications.custom(title, body, url);

    const sent = await pushService.sendToTable(req.params.tableId, payload);
    res.json({ sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send push' });
  }
});

// Broadcast to all subscribers
router.post('/admin/send/all', adminAuth, async (req, res) => {
  try {
    const { title, body, url } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
    const payload = pushService.notifications.custom(title, body, url);
    const sent = await pushService.sendToAll(payload);
    res.json({ sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to broadcast push' });
  }
});

// Get subscriber count
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('pushSubscriptions').count().get();
    res.json({ total: snap.data().count });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Campaigns: notifications the admin writes and sends (or schedules) ─────────

router.get('/admin/audiences', adminAuth, async (req, res) => {
  try {
    res.json({ audiences: await pushService.audienceCounts() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/campaigns', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('pushCampaigns').get();
    const toIso = (t) => t?.toDate?.()?.toISOString() || null;
    const campaigns = snap.docs
      .map((d) => {
        const c = d.data();
        return {
          id: d.id, title: c.title, body: c.body, url: c.url || '/', audience: c.audience, status: c.status,
          repeat: c.repeat || 'none', sentCount: c.sentCount ?? null, targetCount: c.targetCount ?? null,
          runCount: c.runCount || 0, error: c.error || null,
          scheduledAt: toIso(c.scheduledAt), lastSentAt: toIso(c.lastSentAt), createdAt: toIso(c.createdAt),
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 50);
    res.json({ campaigns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send now, or (with scheduledAt) at a set time — optionally repeating weekly.
router.post('/admin/campaigns', adminAuth, async (req, res) => {
  try {
    const { title, body, url, audience, scheduledAt, repeat } = req.body;
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Add a title and a message.' });
    if (title.trim().length > 65) return res.status(400).json({ error: 'Title is too long (max 65 characters).' });
    if (body.trim().length > 240) return res.status(400).json({ error: 'Message is too long (max 240 characters).' });
    if (!pushService.AUDIENCES.some((a) => a.id === audience)) return res.status(400).json({ error: 'Pick who should get this.' });
    const link = (url || '/').trim();
    if (!(link.startsWith('/') || /^https:\/\//.test(link))) return res.status(400).json({ error: 'Link must start with / or https://' });

    let when = null;
    if (scheduledAt) {
      when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'That date/time is not valid.' });
      if (when.getTime() < Date.now() - 60 * 1000) return res.status(400).json({ error: 'Pick a time in the future.' });
    }

    const base = {
      title: title.trim(), body: body.trim(), url: link, audience,
      repeat: repeat === 'weekly' && when ? 'weekly' : 'none',
      createdBy: req.admin.email || req.admin.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      runCount: 0,
    };

    if (when) {
      const ref = await db.collection('pushCampaigns').add({ ...base, status: 'scheduled', scheduledAt: admin.firestore.Timestamp.fromDate(when) });
      return res.json({ id: ref.id, status: 'scheduled' });
    }

    const ref = await db.collection('pushCampaigns').add({ ...base, status: 'sending' });
    try {
      const { target, sent } = await pushService.sendToAudience(audience, pushService.notifications.custom(base.title, base.body, link));
      await ref.set({ status: 'sent', sentCount: sent, targetCount: target, runCount: 1, lastSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      res.json({ id: ref.id, status: 'sent', sent, target });
    } catch (err) {
      await ref.set({ status: 'failed', error: String(err.message).slice(0, 200) }, { merge: true });
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send that notification.' });
  }
});

// Cancels a scheduled one, or clears an old entry from the history.
router.delete('/admin/campaigns/:id', adminAuth, async (req, res) => {
  try {
    await db.collection('pushCampaigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
