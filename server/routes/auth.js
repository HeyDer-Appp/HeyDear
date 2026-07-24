const express = require('express');
const router = express.Router();
const { admin, db, auth } = require('../firebase');
const { adminAuth, attendeeAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { isValidEmail } = require('../utils/validate');

// Attendee signup/login happen client-side directly against Firebase Auth
// (createUserWithEmailAndPassword / signInWithEmailAndPassword) — the server
// never sees the password. This endpoint just creates the corresponding
// Firestore profile doc right after a fresh signup succeeds.
router.post('/attendee/register', attendeeAuth, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'First and last name required' });

    const ref = db.collection('users').doc(req.user.id);
    const existing = await ref.get();
    if (existing.exists) return res.json({ success: true });

    await ref.set({
      firstName,
      lastName,
      email: req.user.email,
      phone: null,
      dob: null,
      gender: null,
      country: null,
      city: 'Auckland',
      referralCode: null,
      profileComplete: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function createAdminUser({ email, password, name }) {
  const userRecord = await auth.createUser({ email, password, displayName: name });
  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
  await db.collection('admins').doc(userRecord.uid).set({
    name,
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return userRecord;
}

router.post('/admin/setup', authLimiter, async (req, res) => {
  try {
    const existing = await db.collection('admins').limit(1).get();
    if (!existing.empty) {
      return res.status(403).json({ error: 'Admin already configured' });
    }

    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    await createAdminUser({ email, password, name });
    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Lets an already-authenticated admin create additional admin accounts —
// there's no public admin signup beyond the one-time bootstrap above.
router.post('/admin/create', adminAuth, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    await createAdminUser({ email, password, name });
    res.json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
