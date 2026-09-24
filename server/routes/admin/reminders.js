const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const reminders = require('../../services/reminders');

// The automatic reminders, with what each will do next.
router.get('/', adminAuth, async (req, res) => {
  try {
    res.json(await reminders.nextSchedule());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!reminders.RULE_IDS.has(id)) return res.status(404).json({ error: 'Unknown reminder' });
    const { enabled, daysBefore, time, title, body } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (enabled !== undefined) updates.enabled = !!enabled;
    if (daysBefore !== undefined) {
      if (!Number.isInteger(daysBefore) || daysBefore < -3 || daysBefore > 10) return res.status(400).json({ error: 'Days before must be between -3 and 10.' });
      updates.daysBefore = daysBefore;
    }
    if (time !== undefined) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: 'Time must look like 18:30.' });
      updates.time = time;
    }
    if (title !== undefined) {
      if (!String(title).trim() || String(title).length > 65) return res.status(400).json({ error: 'Title must be 1–65 characters.' });
      updates.title = String(title).trim();
    }
    if (body !== undefined) {
      if (!String(body).trim() || String(body).length > 240) return res.status(400).json({ error: 'Message must be 1–240 characters.' });
      updates.body = String(body).trim();
    }
    await db.collection('reminderRules').doc(id).set(updates, { merge: true });
    res.json(await reminders.nextSchedule());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Back to the built-in wording and timing.
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (!reminders.RULE_IDS.has(req.params.id)) return res.status(404).json({ error: 'Unknown reminder' });
    await db.collection('reminderRules').doc(req.params.id).delete();
    res.json(await reminders.nextSchedule());
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
