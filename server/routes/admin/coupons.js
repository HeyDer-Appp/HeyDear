const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

const VALID_TYPES = ['one_time', 'subscription'];

router.get('/', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('coupons').orderBy('createdAt', 'desc').get();
    const coupons = snap.docs.map((d) => {
      const c = d.data();
      const expiresAt = toDate(c.expiresAt);
      return {
        code: d.id,
        discountPercent: c.discountPercent,
        type: c.type || null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        expired: !!(expiresAt && expiresAt < new Date()),
        active: c.active !== false,
        redemptionCount: c.redemptionCount || 0,
        ambassadorId: c.ambassadorId || null,
        createdAt: toDate(c.createdAt)?.toISOString() || null,
      };
    });
    res.json({ coupons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Everyone who's redeemed this specific coupon — one row per completed
// checkout, oldest to newest doesn't matter here so newest-first for
// relevance in the admin view.
router.get('/:code/redemptions', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('coupons').doc(req.params.code.toUpperCase())
      .collection('redemptions').orderBy('redeemedAt', 'desc').get();
    const redemptions = snap.docs.map(d => {
      const r = d.data();
      return {
        id: d.id,
        userId: r.userId,
        email: r.email,
        name: r.name,
        plan: r.plan,
        amount: r.amount,
        redeemedAt: toDate(r.redeemedAt)?.toISOString() || null,
      };
    });
    res.json({ redemptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { code, discountPercent, expiresAt, type } = req.body;
    if (!code || !/^[A-Za-z0-9_-]{3,20}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 3-20 letters, numbers, - or _.' });
    }
    const pct = Number(discountPercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return res.status(400).json({ error: 'Discount must be a percentage between 1 and 100.' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type must be one_time or subscription.' });
    }

    const id = code.trim().toUpperCase();
    const ref = db.collection('coupons').doc(id);
    if ((await ref.get()).exists) return res.status(400).json({ error: 'That code already exists.' });

    await ref.set({
      discountPercent: pct,
      type,
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt)) : null,
      active: true,
      redemptionCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ coupon: { code: id, discountPercent: pct, type, expiresAt: expiresAt || null, expired: false, active: true, redemptionCount: 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:code', adminAuth, async (req, res) => {
  try {
    const { active, discountPercent, expiresAt, type } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (active !== undefined) updates.active = !!active;
    if (discountPercent !== undefined) {
      const pct = Number(discountPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return res.status(400).json({ error: 'Invalid discount percent.' });
      updates.discountPercent = pct;
    }
    if (expiresAt !== undefined) {
      updates.expiresAt = expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt)) : null;
    }
    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Type must be one_time or subscription.' });
      updates.type = type;
    }

    const ref = db.collection('coupons').doc(req.params.code.toUpperCase());
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Coupon not found' });
    await ref.set(updates, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:code', adminAuth, async (req, res) => {
  try {
    await db.collection('coupons').doc(req.params.code.toUpperCase()).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
