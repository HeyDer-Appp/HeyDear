const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { sendEmail, baseTemplate } = require('../services/email');

const VENUE_TYPES = ['restaurant', 'bar', 'venue', 'other'];

// Public — no auth, this is the "Partner with us" marketing page's own
// lead-capture form. Stored in Firestore too (not just emailed) so a
// submission isn't lost if hello@heyder.nz ever bounces or lands in spam,
// same reasoning as the safetyReports collection backing the report feature.
router.post('/', async (req, res) => {
  try {
    const { name, establishmentName, venueType, phone, email } = req.body;
    if (!name?.trim() || !establishmentName?.trim() || !phone?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Please fill in all fields.' });
    }
    if (!VENUE_TYPES.includes(venueType)) {
      return res.status(400).json({ error: 'Please select what kind of place you run.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const inquiry = {
      name: name.trim(),
      establishmentName: establishmentName.trim(),
      venueType,
      phone: phone.trim(),
      email: email.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('partnerInquiries').add(inquiry);

    await sendEmail({
      to: 'hello@heyder.nz',
      subject: `New partner inquiry — ${inquiry.establishmentName}`,
      html: baseTemplate('New Partner Inquiry', `
        <h1>New partner inquiry</h1>
        <div class="card">
          <p>Name: <strong>${inquiry.name}</strong></p>
          <p>Establishment: <strong>${inquiry.establishmentName}</strong></p>
          <p>Type: <strong>${inquiry.venueType}</strong></p>
          <p>Phone: <strong>${inquiry.phone}</strong></p>
          <p>Email: <strong>${inquiry.email}</strong></p>
        </div>
      `),
    }).catch((err) => console.error('Partner inquiry email failed:', err));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
