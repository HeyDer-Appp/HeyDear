const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { adminAuth } = require('../middleware/auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');
const pushService = require('../services/push');

router.post('/submit', feedbackLimiter, async (req, res) => {
  try {
    const {
      userId, dinnerId,
      overall_rating, group_fit, venue_rating, experience_notes,
    } = req.body;

    const ref = await db.collection('feedback').add({
      userId: userId || null,
      dinnerId: dinnerId || null,
      overall_rating: overall_rating ?? null,
      group_fit: group_fit ?? null,
      venue_rating: venue_rating ?? null,
      experience_notes: experience_notes || null,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();

    res.json({ success: true, feedback: { id: ref.id, ...snap.data() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.query;
    // Filtering by dinnerId AND sorting by submittedAt needs a composite
    // index, so only chain orderBy() server-side when there's no filter —
    // otherwise sort in memory after fetching.
    let snap;
    if (dinnerId) {
      snap = await db.collection('feedback').where('dinnerId', '==', dinnerId).get();
    } else {
      snap = await db.collection('feedback').orderBy('submittedAt', 'desc').get();
    }
    const feedback = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));

    const userIds = [...new Set(feedback.map(f => f.userId).filter(Boolean))];
    const dinnerIds = [...new Set(feedback.map(f => f.dinnerId).filter(Boolean))];
    const [userDocs, dinnerDocs] = await Promise.all([
      Promise.all(userIds.map(id => db.collection('users').doc(id).get())),
      Promise.all(dinnerIds.map(id => db.collection('dinners').doc(id).get())),
    ]);
    const usersById = Object.fromEntries(userDocs.filter(d => d.exists).map(d => [d.id, d.data()]));
    const dinnersById = Object.fromEntries(dinnerDocs.filter(d => d.exists).map(d => [d.id, d.data()]));

    feedback.forEach(f => {
      const user = usersById[f.userId];
      const dinner = dinnersById[f.dinnerId];
      f.first_name = user?.firstName || null;
      f.last_name = user?.lastName || null;
      f.dinner_date = dinner?.date?.toDate?.() ? dinner.date.toDate().toISOString() : (dinner?.date || null);
    });

    const avg = (key) => {
      const withValue = feedback.filter(f => f[key] != null);
      return withValue.length ? withValue.reduce((s, f) => s + f[key], 0) / withValue.length : null;
    };
    const stats = {
      avg_rating: avg('overall_rating'),
      avg_group_fit: avg('group_fit'),
      avg_venue_rating: avg('venue_rating'),
      total: feedback.length,
    };

    res.json({ feedback, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Every diner at a dinner, with their table and what they said (or that they
// haven't yet) — the "see feedback of each and every diner" view.
async function dinnerDiners(dinnerId) {
  const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerId).get();
  const tables = Object.fromEntries(tablesSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
  const [membersSnap, fbSnap] = await Promise.all([
    db.collection('tableMembers').where('dinnerId', '==', dinnerId).get(),
    db.collection('feedback').where('dinnerId', '==', dinnerId).get(),
  ]);
  const fbByUser = {};
  fbSnap.docs.forEach(d => { if (d.data().userId) fbByUser[d.data().userId] = { id: d.id, ...d.data() }; });
  const diners = membersSnap.docs
    .map(d => d.data())
    .filter(m => tables[m.tableId] && tables[m.tableId].status === 'confirmed')
    .map(m => {
      const f = fbByUser[m.user_id];
      return {
        user_id: m.user_id,
        name: [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Guest',
        table_id: m.tableId,
        table_name: tables[m.tableId].name || null,
        table_number: tables[m.tableId].tableNumber || null,
        submitted: !!f,
        overall_rating: f ? f.overall_rating ?? null : null,
        group_fit: f ? f.group_fit ?? null : null,
        venue_rating: f ? f.venue_rating ?? null : null,
        notes: f ? f.experience_notes || null : null,
        submitted_at: f && f.submittedAt && f.submittedAt.toDate ? f.submittedAt.toDate().toISOString() : null,
      };
    })
    .sort((a, b) => String(a.table_name || a.table_number || '').localeCompare(String(b.table_name || b.table_number || '')) || a.name.localeCompare(b.name));
  return diners;
}

router.get('/by-dinner/:dinnerId', adminAuth, async (req, res) => {
  try {
    const diners = await dinnerDiners(req.params.dinnerId);
    const rated = diners.filter(d => d.submitted);
    const avg = (k) => { const v = rated.filter(d => d[k] != null); return v.length ? v.reduce((s, d) => s + d[k], 0) / v.length : null; };
    res.json({
      diners,
      stats: { diners: diners.length, responded: rated.length, avg_rating: avg('overall_rating'), avg_group_fit: avg('group_fit'), avg_venue_rating: avg('venue_rating') },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Nudge the diners who haven't given feedback yet.
router.post('/request/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const pending = (await dinnerDiners(dinnerId)).filter(d => !d.submitted && d.user_id);
    let sent = 0;
    for (const d of pending) {
      const payload = pushService.notifications.custom('How was your dinner? 💬', 'Two minutes to share your feedback — it shapes every dinner.', `/feedback/${dinnerId}?uid=${d.user_id}`);
      try { sent += await pushService.sendToUser(d.user_id, payload); } catch { /* skip */ }
    }
    res.json({ success: true, pending: pending.length, sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
