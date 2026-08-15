const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { stripe } = require('../services/stripe');
const { ANSWER_FIELDS } = require('../utils/answerFields');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// The table glimpse (meet-your-table reveal) unlocks 48h before the 7pm
// sit-down itself — i.e. 7pm the Sunday before a Tuesday dinner — not
// relative to whenever an admin happened to confirm the table. Mirrors the
// same dinner-date-relative pattern used for the group chat and album
// reveal windows.
function dinnerAt(dinnerDate, hours, minutes = 0) {
  const d = new Date(dinnerDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
function glimpseRevealAt(dinnerDate) {
  return new Date(dinnerAt(dinnerDate, 19, 0).getTime() - 48 * 60 * 60 * 1000);
}
// Venue details unlock 24h after the group reveal — i.e. 7pm the Monday
// before a Tuesday dinner (24h before the sit-down itself). Same
// dinner-relative basis as the group reveal, not tied to whenever an admin
// happened to confirm the table.
function venueRevealAt(dinnerDate) {
  return new Date(glimpseRevealAt(dinnerDate).getTime() + 24 * 60 * 60 * 1000);
}

router.get('/profile', attendeeAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });
    const user = { id: snap.id, ...snap.data() };
    res.json({
      user: {
        ...user,
        first_name: user.firstName,
        last_name: user.lastName,
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

    // Full set (not just EDITABLE_FIELDS) so the profile builder can prefill
    // everything already saved — including Auckland/date, which the
    // post-completion edit page (PATCH /profile below) deliberately excludes.
    const answers = {};
    for (const key of ANSWER_FIELDS) answers[key] = user[key];

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
      photo: user.photo || null,
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

    // Photo lives only on the user doc — kept out of `updates` so it never
    // gets copied onto a booking doc via syncPendingBooking below.
    const userDocUpdates = { ...updates };
    if ('photo' in req.body) {
      const { photo } = req.body;
      if (photo !== null && (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 800_000)) {
        return res.status(400).json({ error: 'Invalid or oversized photo' });
      }
      userDocUpdates.photo = photo;
    }

    if (!Object.keys(userDocUpdates).length) return res.status(400).json({ error: 'Nothing to update' });

    userDocUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(req.user.id).set(userDocUpdates, { merge: true });
    if (Object.keys(updates).length) await syncPendingBooking(req.user.id, updates);

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

      const dinnerDate = dinner.date ? toDate(dinner.date) : null;
      const revealAt = dinnerDate ? glimpseRevealAt(dinnerDate) : null;
      const venueAt = dinnerDate ? venueRevealAt(dinnerDate) : null;
      const venueRevealed = venueAt ? new Date() >= venueAt : false;

      // Only relevant for past dinners, but cheap enough to check for all —
      // lets the dashboard show "Rate your experience" only once, not repeat
      // the prompt after it's already been submitted.
      const feedbackSnap = await db.collection('feedback')
        .where('userId', '==', req.user.id)
        .where('dinnerId', '==', table.dinnerId)
        .limit(1)
        .get();

      return {
        table_id: booking.tableId,
        dinner_id: table.dinnerId,
        table_status: table.status,
        confirmed: true,
        held_over: false,
        date: dinnerDate ? dinnerDate.toISOString() : null,
        city: dinner.city || 'Auckland',
        status: dinner.status,
        reveal_at: revealAt ? revealAt.toISOString() : null,
        venue_reveal_at: venueAt ? venueAt.toISOString() : null,
        restaurant_name: venueRevealed ? restaurant.name : null,
        restaurant_address: venueRevealed ? restaurant.address : null,
        booking_name: venueRevealed ? table.bookingName : null,
        booking_time: venueRevealed ? restaurant.bookingTime : null,
        menu_price_min: venueRevealed ? restaurant.menuPriceMin : null,
        menu_price_max: venueRevealed ? restaurant.menuPriceMax : null,
        has_feedback: !feedbackSnap.empty,
      };
    }));

    // Gating on "any matched booking ever" broke returning members: once
    // someone has attended even one past dinner, matchedDinners is never
    // empty again, so a brand-new pending booking would never surface. What
    // actually matters is whether they have an upcoming (not past) matched
    // dinner already — if not, a newer pending booking should still show.
    const hasUpcomingMatchedDinner = matchedDinners.some(d => d.date && new Date(d.date) >= new Date());

    let pendingDinners = [];
    if (!hasUpcomingMatchedDinner) {
      // where() + orderBy() on different fields needs a composite index, so
      // filter here and sort in memory instead.
      const pendingSnap = await db.collection('bookings')
        .where('userId', '==', req.user.id)
        .where('matched', '==', false)
        .get();
      if (!pendingSnap.empty) {
        const latestDoc = pendingSnap.docs.slice().sort((a, b) => (b.data().submittedAt?.toMillis?.() || 0) - (a.data().submittedAt?.toMillis?.() || 0))[0];
        const booking = latestDoc.data();
        pendingDinners = [{
          table_id: null,
          // tuesdayDate is the normalized 'YYYY-MM-DD' chosen at signup — the
          // dinners collection doc (and its `date` field) only gets created
          // once matching happens, but the dashboard's reveal countdowns are
          // timed off this date regardless of match status, so it needs to
          // go out even for an unmatched booking.
          date: booking.tuesdayDate || null,
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
// delay (48h before the dinner itself) has elapsed. The client cannot
// unlock this early by changing device time.
router.get('/glimpse/:tableId', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${req.user.id}`).get();
    if (!memberSnap.exists) return res.status(404).json({ error: 'Table not found' });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (table?.status !== 'confirmed') {
      return res.status(403).json({ error: 'Your table is not confirmed yet' });
    }

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);
    if (!dinnerDate) {
      return res.status(403).json({ error: 'Your table is not confirmed yet' });
    }

    const revealAt = glimpseRevealAt(dinnerDate);
    const secondsRemaining = Math.ceil((revealAt - new Date()) / 1000);
    if (secondsRemaining > 0) {
      return res.status(403).json({
        error: 'Your table glimpse isn’t unlocked yet',
        revealAt: revealAt.toISOString(),
        secondsRemaining,
      });
    }

    const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
    const otherMembers = membersSnap.docs.filter(d => d.data().user_id !== req.user.id);
    const photoByUserId = {};
    await Promise.all(otherMembers.map(async (d) => {
      const userId = d.data().user_id;
      const userSnap = await db.collection('users').doc(userId).get();
      photoByUserId[userId] = userSnap.exists ? userSnap.data().photo || null : null;
    }));

    const glimpse = otherMembers.map(d => {
      const m = d.data();
      return {
        country: m.country,
        career_kid: m.career_description,
        photo: photoByUserId[m.user_id] || null,
      };
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
    // where() + orderBy() on different fields needs a composite index, so
    // filter here and sort in memory instead.
    const paymentSnap = await db.collection('payments')
      .where('userId', '==', req.user.id)
      .where('status', '==', 'completed')
      .get();
    if (!paymentSnap.empty) {
      const paymentDoc = paymentSnap.docs.slice().sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0))[0];
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
