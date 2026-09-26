const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

// Restaurants are a standing roster — a partner is added once when they come
// on board with HeyDer, then reused across every dinner going forward,
// rather than being re-entered per dinner.
router.get('/', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('restaurants').get();
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

router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, address, booking_time, menu_price_min, menu_price_max, capacity, notes, kind, area, activity } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
    const ref = await db.collection('restaurants').add({
      name,
      address,
      bookingTime: booking_time || '19:00',
      menuPriceMin: menu_price_min ?? null,
      menuPriceMax: menu_price_max ?? null,
      capacity: capacity || 6,
      notes: notes || null,
      kind: kind === 'afterparty' ? 'afterparty' : 'restaurant',
      area: (area || '').trim() || null,
      activity: (activity || '').trim().slice(0, 60) || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.json({ restaurant: { id: ref.id, ...snap.data(), table_count: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const fieldMap = {
      name: 'name', address: 'address', booking_time: 'bookingTime',
      menu_price_min: 'menuPriceMin', menu_price_max: 'menuPriceMax', capacity: 'capacity', notes: 'notes', kind: 'kind', area: 'area', activity: 'activity',
    };
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const [bodyKey, docKey] of Object.entries(fieldMap)) {
      if (req.body[bodyKey] !== undefined) updates[docKey] = req.body[bodyKey];
    }
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Nothing to update' });

    const ref = db.collection('restaurants').doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Restaurant not found' });

    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    res.json({ restaurant: { id: ref.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
