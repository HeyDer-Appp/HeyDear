const express = require('express');
const router = express.Router();
const { db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

function toIso(v) {
  if (!v) return null;
  return (typeof v.toDate === 'function' ? v.toDate() : new Date(v)).toISOString();
}

// One row per table for a dinner, with photo/message counts, so an admin
// can see at a glance which tables have activity worth reviewing before
// drilling into either feed.
router.get('/tables/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerId).get();

    const tables = await Promise.all(tablesSnap.docs.map(async (t) => {
      const table = t.data();
      const [photosSnap, messagesSnap, membersSnap] = await Promise.all([
        db.collection('dinnerPhotos').where('tableId', '==', t.id).count().get(),
        db.collection('groupMessages').where('tableId', '==', t.id).count().get(),
        db.collection('tableMembers').where('tableId', '==', t.id).get(),
      ]);
      return {
        id: t.id,
        table_number: table.table_number,
        status: table.status,
        member_count: membersSnap.size,
        photo_count: photosSnap.data().count,
        message_count: messagesSnap.data().count,
      };
    }));

    tables.sort((a, b) => (a.table_number || 0) - (b.table_number || 0));
    res.json({ tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/tables/:tableId/photos', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('dinnerPhotos').where('tableId', '==', req.params.tableId).get();
    const photos = snap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt) }))
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    res.json({ photos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/photos/:photoId', adminAuth, async (req, res) => {
  try {
    await db.collection('dinnerPhotos').doc(req.params.photoId).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Deliberately no route reads group chat message content here — attendees'
// chats aren't something admin browses, on request. Only an aggregate count
// (above, in /tables/:dinnerId) is exposed, which says "how active" a table
// is without revealing what anyone actually said.

module.exports = router;
