const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

router.get('/', adminAuth, async (req, res) => {
  try {
    const [ambassadorsSnap, confirmedMembersSnap] = await Promise.all([
      db.collection('ambassadors').orderBy('createdAt', 'desc').get(),
      db.collection('tableMembers').where('confirmed', '==', true).get(),
    ]);
    const confirmedUserIds = confirmedMembersSnap.docs.map(d => d.data().user_id);

    const ambassadors = await Promise.all(ambassadorsSnap.docs.map(async (a) => {
      const referralsSnap = await db.collection('ambassadors').doc(a.id).collection('referrals').get();
      const referredUserIds = new Set(referralsSnap.docs.map(d => d.id));
      const dinnersAttended = confirmedUserIds.filter(uid => referredUserIds.has(uid)).length;

      return {
        id: a.id,
        ...a.data(),
        referral_code: a.id,
        total_referrals: referralsSnap.size,
        dinners_attended: dinnersAttended,
      };
    }));

    res.json({ ambassadors });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, email, instagram_handle, tier = 'Trial', notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    let code;
    let ref;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateReferralCode(name);
      ref = db.collection('ambassadors').doc(code);
      if (!(await ref.get()).exists) break;
    }

    await ref.set({
      name,
      email: email || null,
      instagram_handle: instagram_handle || null,
      tier,
      active: true,
      notes: notes || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.json({ ambassador: { id: ref.id, ...snap.data(), referral_code: ref.id } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, instagram_handle, tier, active, notes } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (instagram_handle !== undefined) updates.instagram_handle = instagram_handle;
    if (tier !== undefined) updates.tier = tier;
    if (active !== undefined) updates.active = active;
    if (notes !== undefined) updates.notes = notes;

    const ref = db.collection('ambassadors').doc(req.params.id);
    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ ambassador: { id: ref.id, ...snap.data(), referral_code: ref.id } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/referrals', adminAuth, async (req, res) => {
  try {
    const referralsSnap = await db.collection('ambassadors').doc(req.params.id).collection('referrals')
      .orderBy('createdAt', 'desc').get();

    const referrals = await Promise.all(referralsSnap.docs.map(async (r) => {
      const userSnap = await db.collection('users').doc(r.id).get();
      const user = userSnap.data() || {};
      return {
        user_id: r.id,
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        signup_date: user.createdAt?.toDate?.().toISOString() || null,
      };
    }));

    res.json({ referrals });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

function generateReferralCode(name) {
  const base = name.toLowerCase().replace(/[^a-z]/g, '').substring(0, 8);
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${suffix}`;
}

module.exports = router;
