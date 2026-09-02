const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { nzTime } = require('../utils/nzTime');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// The photo-upload window for a dinner: opens 7pm the night of (Tuesday),
// closes 7pm the following day (Wednesday) — one full day to share photos
// from the night out, then it's locked for good.
function albumWindow(dinnerDate) {
  const open = nzTime(dinnerDate, 19, 0);
  const close = new Date(open.getTime() + 24 * 60 * 60 * 1000);
  return { open, close };
}

function isWindowOpen(dinnerDate) {
  if (!dinnerDate) return false;
  const { open, close } = albumWindow(dinnerDate);
  const now = new Date();
  return now >= open && now < close;
}

// Every dinner this attendee was matched into, each with its photos (if
// any) and who sat at that table — grouped so the album reads as one
// stack per Tuesday night rather than one long photo stream.
router.get('/', attendeeAuth, async (req, res) => {
  try {
    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', req.user.id)
      .where('matched', '==', true)
      .get();

    const tableIds = [...new Set(bookingSnap.docs.map(d => d.data().tableId).filter(Boolean))];

    const dinners = await Promise.all(tableIds.map(async (tableId) => {
      const tableSnap = await db.collection('tables').doc(tableId).get();
      const table = tableSnap.data();
      if (!table) return null;

      const [dinnerSnap, membersSnap, photosSnap] = await Promise.all([
        db.collection('dinners').doc(table.dinnerId).get(),
        db.collection('tableMembers').where('tableId', '==', tableId).get(),
        db.collection('dinnerPhotos').where('tableId', '==', tableId).get(),
      ]);

      const dinner = dinnerSnap.data() || {};
      const dinnerDate = toDate(dinner.date);

      const attendees = membersSnap.docs
        .map(d => {
          const m = d.data();
          return `${m.firstName || ''} ${m.lastName ? m.lastName.charAt(0) + '.' : ''}`.trim();
        })
        .filter(Boolean);

      const photos = photosSnap.docs
        .map(d => ({
          id: d.id,
          photo: d.data().photo,
          userId: d.data().userId,
          uploaderName: d.data().uploaderFirstName || '',
          createdAt: toDate(d.data().createdAt)?.toISOString() || null,
        }))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      const { open, close } = dinnerDate ? albumWindow(dinnerDate) : {};

      return {
        table_id: tableId,
        // The 7pm-NZT dinner-start instant, not midnight UTC of the day —
        // avoids the date label shifting a day off in some viewer timezones.
        date: dinnerDate ? nzTime(dinnerDate, 19, 0).toISOString() : null,
        city: dinner.city || 'Auckland',
        attendees,
        photos,
        can_upload: isWindowOpen(dinnerDate),
        upload_opens_at: open ? open.toISOString() : null,
        upload_closes_at: close ? close.toISOString() : null,
      };
    }));

    const clean = dinners
      .filter(Boolean)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.json({ dinners: clean });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Uploads one photo to a dinner's shared album. Only open from 7pm the
// night of until 7pm the next day, and only for people who actually sat
// at that table — both checked server-side so neither can be bypassed
// from the client.
router.post('/:tableId/photos', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { photo } = req.body;

    if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 1_400_000) {
      return res.status(400).json({ error: 'Invalid or oversized photo' });
    }

    const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${req.user.id}`).get();
    if (!memberSnap.exists) return res.status(403).json({ error: "You weren't seated at this table" });
    const member = memberSnap.data();

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);

    if (!isWindowOpen(dinnerDate)) {
      return res.status(403).json({ error: 'Photo uploads are only open from 7pm Tuesday to 7pm Wednesday.' });
    }

    const docRef = await db.collection('dinnerPhotos').add({
      tableId,
      dinnerId: table.dinnerId,
      userId: req.user.id,
      uploaderFirstName: member.firstName || '',
      photo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      photo: {
        id: docRef.id,
        photo,
        uploaderName: member.firstName || '',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Removes one photo the caller uploaded — anyone else's photo, even from
// the same table, is off-limits. No time-window restriction (unlike
// uploading itself) since there's no real reason someone shouldn't be able
// to take down their own photo later, e.g. months after the dinner.
router.delete('/:tableId/photos/:photoId', attendeeAuth, async (req, res) => {
  try {
    const { tableId, photoId } = req.params;

    const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${req.user.id}`).get();
    if (!memberSnap.exists) return res.status(403).json({ error: "You weren't seated at this table" });

    const photoRef = db.collection('dinnerPhotos').doc(photoId);
    const photoSnap = await photoRef.get();
    if (!photoSnap.exists || photoSnap.data().tableId !== tableId) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    if (photoSnap.data().userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete photos you uploaded.' });
    }

    await photoRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
