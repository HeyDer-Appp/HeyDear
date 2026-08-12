const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

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
    const { date, city, status } = req.body;
    if (date && !isTuesday(date)) return res.status(400).json({ error: 'HeyDer dinners only happen on Tuesdays — pick a Tuesday date.' });
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (date) updates.date = dateToTimestamp(date);
    if (city) updates.city = city;
    if (status) updates.status = status;

    const ref = db.collection('dinners').doc(req.params.id);
    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    res.json({ dinner: { id: ref.id, ...snap.data(), date: snap.data().date.toDate().toISOString() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/restaurants', adminAuth, async (req, res) => {
  try {
    // where() + orderBy() on different fields needs a composite index, so
    // filter here and sort in memory instead.
    const snap = await db.collection('restaurants').where('dinnerId', '==', req.params.id).get();
    const sortedDocs = snap.docs.slice().sort((a, b) => (a.data().name || '').localeCompare(b.data().name || ''));
    const restaurants = await Promise.all(sortedDocs.map(async (r) => {
      const tc = await db.collection('tables').where('restaurantId', '==', r.id).count().get();
      return { id: r.id, ...r.data(), table_count: tc.data().count };
    }));
    res.json({ restaurants });
  } catch (err) {
    console.error('Restaurants error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/restaurants', adminAuth, async (req, res) => {
  try {
    const { name, address, booking_time, menu_price_min, menu_price_max, capacity, notes } = req.body;
    const ref = await db.collection('restaurants').add({
      dinnerId: req.params.id,
      name,
      address,
      bookingTime: booking_time || '19:00',
      menuPriceMin: menu_price_min ?? null,
      menuPriceMax: menu_price_max ?? null,
      capacity: capacity || 6,
      notes: notes || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.json({ restaurant: { id: ref.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/restaurants/:id', adminAuth, async (req, res) => {
  try {
    const fieldMap = {
      name: 'name', address: 'address', booking_time: 'bookingTime',
      menu_price_min: 'menuPriceMin', menu_price_max: 'menuPriceMax', capacity: 'capacity', notes: 'notes',
    };
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const [bodyKey, docKey] of Object.entries(fieldMap)) {
      if (req.body[bodyKey] !== undefined) updates[docKey] = req.body[bodyKey];
    }
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Nothing to update' });

    const ref = db.collection('restaurants').doc(req.params.id);
    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    res.json({ restaurant: { id: ref.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
