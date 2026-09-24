const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const { nzTime } = require('../../utils/nzTime');

// Dates are stored as UTC-midnight Timestamps so they round-trip cleanly
// against the 'YYYY-MM-DD' strings bookings store their tuesdayDate as.
function dateToTimestamp(dateStr) {
  return admin.firestore.Timestamp.fromDate(new Date(`${dateStr}T00:00:00.000Z`));
}

// HeyDer dinners only ever happen on Tuesdays — checked against the same
// UTC-midnight interpretation dateToTimestamp uses, so this agrees with
// whatever day actually gets stored.
function isTuesday(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay() === 2;
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { city } = req.query;
    const snap = await db.collection('dinners').orderBy('date', 'desc').get();
    let dinners = await Promise.all(snap.docs.map(async (d) => {
      const [tablesSnap, membersSnap] = await Promise.all([
        db.collection('tables').where('dinnerId', '==', d.id).get(),
        db.collection('tableMembers').where('dinnerId', '==', d.id).get(),
      ]);
      return {
        id: d.id,
        ...d.data(),
        date: d.data().date.toDate().toISOString(),
        table_count: tablesSnap.size,
        attendee_count: membersSnap.size,
        // 7pm on the night, and the moment groups are announced to diners
        // (94h before — the same "Group found" moment the app's countdown uses).
        dinner_at: nzTime(d.data().date.toDate(), 19, 0).toISOString(),
        groups_live_at: new Date(nzTime(d.data().date.toDate(), 19, 0).getTime() - 94 * 3600 * 1000).toISOString(),
      };
    }));
    if (city) dinners = dinners.filter(d => (d.city || 'Auckland') === city);
    res.json({ dinners });
  } catch (err) {
    console.error('Dinners error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { date, city = 'Auckland', status = 'upcoming' } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    if (!isTuesday(date)) return res.status(400).json({ error: 'HeyDer dinners only happen on Tuesdays — pick a Tuesday date.' });
    const ref = await db.collection('dinners').add({
      date: dateToTimestamp(date),
      city,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.json({ dinner: { id: ref.id, ...snap.data(), date: snap.data().date.toDate().toISOString() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { date, city, status, area, afterpartyId, afterpartyNote } = req.body;
    if (date && !isTuesday(date)) return res.status(400).json({ error: 'HeyDer dinners only happen on Tuesdays — pick a Tuesday date.' });
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (date) updates.date = dateToTimestamp(date);
    if (city) updates.city = city;
    if (status) updates.status = status;
    if (typeof area === 'string') updates.area = area.trim() || null;
    if (typeof afterpartyNote === 'string') updates.afterpartyNote = afterpartyNote.trim().slice(0, 300) || null;
    // Snapshot the venue's details onto the dinner so the app can show it
    // without another lookup (and it survives the venue being edited later).
    if (afterpartyId !== undefined) {
      if (!afterpartyId) {
        updates.afterpartyId = null; updates.afterparty = null;
      } else {
        const v = await db.collection('restaurants').doc(afterpartyId).get();
        if (!v.exists) return res.status(400).json({ error: 'That after-party venue no longer exists.' });
        updates.afterpartyId = afterpartyId;
        updates.afterparty = { name: v.data().name, address: v.data().address || null, area: v.data().area || null };
      }
    }

    const ref = db.collection('dinners').doc(req.params.id);
    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    res.json({ dinner: { id: ref.id, ...snap.data(), date: snap.data().date.toDate().toISOString() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
