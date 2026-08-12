const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { adminAuth } = require('../middleware/auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');

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

module.exports = router;
