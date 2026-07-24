const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { adminAuth } = require('../middleware/auth');
const pushService = require('../services/push');

// Attendee subscribes their device
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription, userAgent } = req.body;
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

module.exports = router;
