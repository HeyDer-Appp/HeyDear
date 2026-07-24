const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { adminAuth } = require('../middleware/auth');
const { feedbackLimiter } = require('../middleware/rateLimiter');

router.post('/submit', feedbackLimiter, async (req, res) => {
  try {
    const {
      userId, dinnerId,
      overall_rating, surprised_by, group_fit, conversation_quality,
      venue_rating, return_likelihood, nps, improvement,
      testimonial, testimonial_name,
    } = req.body;

    const ref = await db.collection('feedback').add({
      userId: userId || null,
      dinnerId: dinnerId || null,
      overall_rating: overall_rating ?? null,
      surprised_by: surprised_by || null,
      group_fit: group_fit ?? null,
      conversation_quality: conversation_quality ?? null,
      venue_rating: venue_rating ?? null,
      return_likelihood: return_likelihood || null,
      nps: nps ?? null,
      improvement: improvement || null,
      testimonial: testimonial || null,
      testimonial_name: testimonial_name || null,
      testimonial_approved: false,
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
    let query = db.collection('feedback');
    if (dinnerId) query = query.where('dinnerId', '==', dinnerId);
    const snap = await query.orderBy('submittedAt', 'desc').get();
    const feedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const withRating = feedback.filter(f => f.overall_rating != null);
    const withNps = feedback.filter(f => f.nps != null);
    const withReturn = feedback.filter(f => f.return_likelihood != null);
    const stats = {
      avg_rating: withRating.length ? withRating.reduce((s, f) => s + f.overall_rating, 0) / withRating.length : null,
      avg_nps: withNps.length ? withNps.reduce((s, f) => s + f.nps, 0) / withNps.length : null,
      return_pct: withReturn.length
        ? (withReturn.filter(f => f.return_likelihood === 'Yes').length / withReturn.length) * 100
        : 0,
      total: feedback.length,
    };

    res.json({ feedback, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/testimonials/:id/approve', adminAuth, async (req, res) => {
  try {
    await db.collection('feedback').doc(req.params.id).set({ testimonial_approved: true }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/testimonials/public', async (req, res) => {
  try {
    const snap = await db.collection('feedback')
      .where('testimonial_approved', '==', true)
      .orderBy('submittedAt', 'desc')
      .limit(10)
      .get();
    const testimonials = snap.docs
      .map(d => d.data())
      .filter(f => f.testimonial)
      .map(f => ({ testimonial: f.testimonial, testimonial_name: f.testimonial_name }));
    res.json({ testimonials });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
