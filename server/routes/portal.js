const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { stripe } = require('../services/stripe');

// Table glimpse unlocks 48 hours after the table is confirmed, venue details
// 24 hours after. Override via env vars for local testing only — these
// defaults are the real production values, so a deploy that forgets to set
// the env vars still ships safe (long) delays instead of leaking private
// tablemate/venue info early.
const GLIMPSE_REVEAL_MINUTES = parseInt(process.env.GLIMPSE_REVEAL_MINUTES) || 2880;
const VENUE_REVEAL_MINUTES = parseInt(process.env.VENUE_REVEAL_MINUTES) || 1440;

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

router.get('/profile', attendeeAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });
    const user = { id: snap.id, ...snap.data() };
    res.json({
      user: {
        ...user,
        dietary: user.field_OVB7lzEjSl7C || [],
        budget: user.field_Ar4xQbXT6CLh || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fields the attendee is allowed to edit after profile setup.
// Name, date of birth (age), phone, and email are intentionally excluded —
// those are edited via a support request, not this endpoint.
const EDITABLE_FIELDS = [
  'field_cqCcs6psQuhE', 'field_3zmnHXYzZn17', 'field_aIpzE2elktbh',
  'field_L6GblNns9C7v', 'field_LosYJHqrbpKO', 'field_lS4ks7Km1VlA',
  'field_PyYcCusA8b74', 'field_Y8VLrSMSZLmb', 'field_heE41fid4m48',
  'field_H4KwwtKh8sYF', 'field_OqnhJdRIytBz', 'field_1NDB7q3CaeDQ',
  'field_TaGZoiuhOhh2', 'group_role', 'conflict_style', 'connection_trigger',
  'social_recharge', 'conversation_avoid', 'first_meeting_style',
  'field_TQFTxLhIZnOf', 'field_pCwGXuvIxGTu', 'field_MQDZqx7wid2f',
  'field_Ar4xQbXT6CLh', 'field_OVB7lzEjSl7C',
];

router.get('/full-profile', attendeeAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });
    const user = snap.data();

    const answers = {};
    for (const key of EDITABLE_FIELDS) answers[key] = user[key];

    const subSnap = await db.collection('subscriptions')
      .where('userId', '==', req.user.id)
      .where('status', 'in', ['active', 'trialing'])
      .get();
    const now = new Date();
    const hasActiveSubscription = subSnap.docs.some(d => toDate(d.data().currentPeriodEnd) > now);

    res.json({
      locked: {
        first_name: user.firstName,
        last_name: user.lastName,
        dob: user.dob,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        country: user.country,
      },
      profileComplete: !!user.profileComplete,
      hasActiveSubscription,
      answers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function syncPendingBooking(uid, updates) {
  const pending = await db.collection('bookings')
    .where('userId', '==', uid)
    .where('matched', '==', false)
    .get();
  await Promise.all(pending.docs.map(d => d.ref.set(updates, { merge: true })));
}

router.patch('/profile', attendeeAuth, async (req, res) => {
  try {
    const updates = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in req.body) {
        let value = req.body[key];
        if (key === 'field_OVB7lzEjSl7C') value = Array.isArray(value) ? value : [value];
        updates[key] = value;
      }
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(req.user.id).set(updates, { merge: true });
    await syncPendingBooking(req.user.id, updates);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dinners', attendeeAuth, async (req, res) => {
  try {
    const matchedSnap = await db.collection('bookings')
      .where('userId', '==', req.user.id)
      .where('matched', '==', true)
      .get();

    const matchedDinners = await Promise.all(matchedSnap.docs.map(async (bookingDoc) => {
      const booking = bookingDoc.data();
      const [tableSnap, dinnerSnap] = await Promise.all([
        db.collection('tables').doc(booking.tableId).get(),
        db.collection('dinners').doc(booking.dinnerId).get(),
      ]);
      const table = tableSnap.data() || {};
      const dinner = dinnerSnap.data() || {};
      const restaurantSnap = table.restaurantId
        ? await db.collection('restaurants').doc(table.restaurantId).get()
        : null;
      const restaurant = restaurantSnap?.data() || {};

      const confirmedAt = toDate(table.confirmedAt);
      const venueRevealAt = confirmedAt ? new Date(confirmedAt.getTime() + VENUE_REVEAL_MINUTES * 60000) : null;
      const venueRevealed = venueRevealAt ? new Date() >= venueRevealAt : false;

      return {
        table_id: booking.tableId,
        table_status: table.status,
        confirmed: true,
        held_over: false,
        date: dinner.date ? toDate(dinner.date).toISOString() : null,
        city: dinner.city || 'Auckland',
        status: dinner.status,
        reveal_at: confirmedAt
          ? new Date(confirmedAt.getTime() + GLIMPSE_REVEAL_MINUTES * 60000).toISOString()
          : null,
        venue_reveal_at: venueRevealAt ? venueRevealAt.toISOString() : null,
        restaurant_name: venueRevealed ? restaurant.name : null,
        restaurant_address: venueRevealed ? restaurant.address : null,
        booking_name: venueRevealed ? restaurant.bookingName : null,
        booking_time: venueRevealed ? restaurant.bookingTime : null,
        menu_price_min: venueRevealed ? restaurant.menuPriceMin : null,
        menu_price_max: venueRevealed ? restaurant.menuPriceMax : null,
      };
    }));

    let pendingDinners = [];
    if (matchedDinners.length === 0) {
      const pendingSnap = await db.collection('bookings')
        .where('userId', '==', req.user.id)
        .where('matched', '==', false)
        .orderBy('submittedAt', 'desc')
        .limit(1)
        .get();
      if (!pendingSnap.empty) {
        const booking = pendingSnap.docs[0].data();
        pendingDinners = [{
          table_id: null,
          date: null,
          preferred_date: booking.field_CdZldwp5q09o,
          city: 'Auckland',
          table_status: null,
          restaurant_name: null,
          restaurant_address: null,
          confirmed: false,
          is_pending: true,
        }];
      }
    }

    res.json({ dinners: [...matchedDinners, ...pendingDinners] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Server-side gated reveal — only returns tablemate glimpses once the reveal
// delay has elapsed since the table was confirmed. The client cannot unlock
// this early by changing device time.
router.get('/glimpse/:tableId', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${req.user.id}`).get();
    if (!memberSnap.exists) return res.status(404).json({ error: 'Table not found' });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    const confirmedAt = toDate(table?.confirmedAt);
    if (table?.status !== 'confirmed' || !confirmedAt) {
      return res.status(403).json({ error: 'Your table is not confirmed yet' });
    }

    const revealAt = new Date(confirmedAt.getTime() + GLIMPSE_REVEAL_MINUTES * 60000);
    const secondsRemaining = Math.ceil((revealAt - new Date()) / 1000);
    if (secondsRemaining > 0) {
      return res.status(403).json({
        error: 'Your table glimpse isn’t unlocked yet',
        revealAt: revealAt.toISOString(),
        secondsRemaining,
      });
    }

    const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
    const glimpse = membersSnap.docs
      .filter(d => d.data().user_id !== req.user.id)
      .map(d => {
        const m = d.data();
        return { country: m.country, career_kid: m.careerDescription };
      });

    res.json({ glimpse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/dietary', attendeeAuth, async (req, res) => {
  try {
    const { dietary } = req.body;
    const dietaryArray = Array.isArray(dietary) ? dietary : [dietary];
    const updates = {
      field_OVB7lzEjSl7C: dietaryArray,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(req.user.id).set(updates, { merge: true });
    await syncPendingBooking(req.user.id, updates);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/cancel/:tableId', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const memberRef = db.collection('tableMembers').doc(`${tableId}_${req.user.id}`);
    const [memberSnap, tableSnap] = await Promise.all([memberRef.get(), db.collection('tables').doc(tableId).get()]);
    if (!memberSnap.exists || !tableSnap.exists) return res.status(404).json({ error: 'Not found' });

    const table = tableSnap.data();
    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);
    const hoursUntil = dinnerDate ? (dinnerDate - new Date()) / (1000 * 60 * 60) : Infinity;

    if (hoursUntil < 48) {
      return res.status(400).json({ error: 'Cancellations must be made at least 48 hours before dinner.' });
    }

    await memberRef.delete();

    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', req.user.id)
      .where('tableId', '==', tableId)
      .get();
    await Promise.all(bookingSnap.docs.map(d => d.ref.set({ matched: false, tableId: null, dinnerId: null }, { merge: true })));

    // Refund the attendee's one-time booking fee, if there's an unrefunded
    // payment on file. Active subscriptions aren't touched here — cancelling
    // one dinner doesn't cancel the membership.
    let refunded = false;
    const paymentSnap = await db.collection('payments')
      .where('userId', '==', req.user.id)
      .where('status', '==', 'completed')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!paymentSnap.empty) {
      const paymentDoc = paymentSnap.docs[0];
      const payment = paymentDoc.data();
      if (payment.stripePaymentIntentId) {
        try {
          await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId });
          await paymentDoc.ref.set({ status: 'refunded', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          refunded = true;
        } catch (refundErr) {
          console.error(`Refund failed for user ${req.user.id}, payment ${paymentDoc.id}:`, refundErr.message);
        }
      }
    }

    res.json({
      success: true,
      message: refunded
        ? 'Booking cancelled. Your refund has been issued and should appear in 2-3 working days.'
        : 'Booking cancelled. If you paid a booking fee, contact info@heyder.nz for your refund.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
