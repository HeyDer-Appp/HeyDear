const express = require('express');
const router = express.Router();
const { db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const { bookingToPerson } = require('../../utils/bookingView');

// Firestore has no ILIKE/free-text search or offset pagination, so — same
// pattern already used for analytics' age-distribution/retention numbers —
// exact-match filters (date/intent/gender) run as Firestore `where` clauses,
// then free-text search and pagination happen in memory. Fine at this app's
// scale (hundreds, not millions, of signups per dinner).
router.get('/', adminAuth, async (req, res) => {
  try {
    const { date, intent, gender, search, page = 1, limit = 50 } = req.query;

    let query = db.collection('bookings');
    if (date) query = query.where('tuesdayDate', '==', date);
    if (gender) query = query.where('gender', '==', gender);

    const snap = await query.get();
    let signups = snap.docs.map(d => {
      const person = bookingToPerson(d.id, d.data());
      const data = d.data();
      // submittedAt is a Firestore Timestamp — already exposed cleanly as
      // person.submitted_at, so it's dropped here rather than serialized twice.
      const { submittedAt, ...raw } = data;
      return { ...person, is_matched: !!data.matched, table_id: data.tableId || null, raw };
    });

    if (intent) {
      const needle = intent.toLowerCase();
      signups = signups.filter(s => s.intent?.toLowerCase().includes(needle));
    }
    if (search) {
      const needle = search.toLowerCase();
      signups = signups.filter(s =>
        s.first_name?.toLowerCase().includes(needle) ||
        s.last_name?.toLowerCase().includes(needle) ||
        s.email?.toLowerCase().includes(needle)
      );
    }

    signups.sort((a, b) => (b.submitted_at?.toMillis?.() || 0) - (a.submitted_at?.toMillis?.() || 0));

    const total = signups.length;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const offset = (pageNum - 1) * limitNum;
    const paged = signups.slice(offset, offset + limitNum).map(s => ({
      ...s,
      submitted_at: s.submitted_at?.toDate?.().toISOString() || null,
    }));

    res.json({ signups: paged, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dates', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('bookings').select('tuesdayDate').get();
    const dates = [...new Set(snap.docs.map(d => d.data().tuesdayDate).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));
    res.json({ dates });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', adminAuth, async (req, res) => {
  try {
    // where() + orderBy() on different fields needs a composite index, so
    // filter here and sort in memory instead.
    const snap = await db.collection('bookings').where('userId', '==', req.params.id).get();
    if (snap.empty) return res.status(404).json({ error: 'Not found' });
    const latestDoc = snap.docs.slice().sort((a, b) => (b.data().submittedAt?.toMillis?.() || 0) - (a.data().submittedAt?.toMillis?.() || 0))[0];
    const signup = bookingToPerson(latestDoc.id, latestDoc.data());
    res.json({ signup: { ...signup, submitted_at: signup.submitted_at?.toDate?.().toISOString() || null } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Deletes a single booking (one signup for one Tuesday), not the user
// account itself — used to clean up duplicate or erroneous signups.
router.delete('/quiz/:quizId', adminAuth, async (req, res) => {
  try {
    const ref = db.collection('bookings').doc(req.params.quizId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/export/csv', adminAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = db.collection('bookings');
    if (date) query = query.where('tuesdayDate', '==', date);
    const snap = await query.get();

    const rows = snap.docs
      .map(d => bookingToPerson(d.id, d.data()))
      .sort((a, b) => (b.submitted_at?.toMillis?.() || 0) - (a.submitted_at?.toMillis?.() || 0))
      .map(s => ({
        first_name: s.first_name, last_name: s.last_name, email: s.email, phone: s.phone,
        gender: s.gender, country: s.country, dob: s.dob,
        intent: s.intent, personality: s.personality, budget: s.budget,
        preferred_date: s.preferred_date, tuesday_date: s.tuesday_date,
        reliability: s.reliability_score, dietary: (s.dietary || []).join('; '),
        dietary_other: s.dietary_other || '',
        submitted_at: s.submitted_at?.toDate?.().toISOString() || '',
      }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="heyder-signups-${date || 'all'}.csv"`);

    // Prefix values that would otherwise be read as a formula (=, +, -, @, tab,
    // carriage return) by Excel/Sheets when opening the export.
    const csvSafe = (v) => {
      const s = String(v || '');
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };

    const headers = Object.keys(rows[0] || {}).join(',');
    const csvRows = rows.map(r =>
      Object.values(r).map(v => `"${csvSafe(v).replace(/"/g, '""')}"`).join(',')
    );

    res.send([headers, ...csvRows].join('\n'));
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
