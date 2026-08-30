const express = require('express');
const router = express.Router();
const { admin, db, auth } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { stripe } = require('../services/stripe');
const { ANSWER_FIELDS } = require('../utils/answerFields');
const { nzTime } = require('../utils/nzTime');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// The table glimpse (meet-your-table reveal) unlocks 48h before the 7pm
// sit-down itself — i.e. 7pm the Sunday before a Tuesday dinner — not
// relative to whenever an admin happened to confirm the table. Mirrors the
// same dinner-date-relative pattern used for the group chat and album
// reveal windows.
function glimpseRevealAt(dinnerDate) {
  return new Date(nzTime(dinnerDate, 19, 0).getTime() - 48 * 60 * 60 * 1000);
}
// Venue details unlock 24h after the group reveal — i.e. 7pm the Monday
// before a Tuesday dinner (24h before the sit-down itself). Same
// dinner-relative basis as the group reveal, not tied to whenever an admin
// happened to confirm the table.
function venueRevealAt(dinnerDate) {
  return new Date(glimpseRevealAt(dinnerDate).getTime() + 24 * 60 * 60 * 1000);
}
// Names and clear photos unlock at 8pm dinner night, once dinner is
// underway — same threshold group.js uses for the group chat's full
// reveal, kept in sync manually since these live in separate route files.
function fullRevealAt(dinnerDate) {
  return nzTime(dinnerDate, 20, 0);
}

router.get('/profile', attendeeAuth, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.user.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });
    const user = { id: snap.id, ...snap.data() };

    const subSnap = await db.collection('subscriptions')
      .where('userId', '==', req.user.id)
      .where('status', 'in', ['active', 'trialing'])
      .get();
    const now = new Date();
    const activeSub = subSnap.docs.find(d => toDate(d.data().currentPeriodEnd) > now);

    res.json({
      user: {
        ...user,
        first_name: user.firstName,
        last_name: user.lastName,
        dietary: user.field_OVB7lzEjSl7C || [],
        budget: user.field_Ar4xQbXT6CLh || null,
      },
      hasActiveSubscription: !!activeSub,
      subscriptionRenewsAt: activeSub ? toDate(activeSub.data().currentPeriodEnd)?.toISOString() || null : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fields the attendee is allowed to edit after profile setup.
// Name, date of birth (age), and email are intentionally excluded — those
// are edited via a support request, not this endpoint. Phone is editable
// (see the dedicated validation on it below).
const EDITABLE_FIELDS = [
  'phone', 'phoneCountryCode',
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
    const activeSub = subSnap.docs.find(d => toDate(d.data().currentPeriodEnd) > now);

    res.json({
      locked: {
        first_name: user.firstName,
        last_name: user.lastName,
        dob: user.dob,
        phone: user.phone,
        phoneCountryCode: user.phoneCountryCode,
        email: user.email,
        gender: user.gender,
        country: user.country,
      },
      profileComplete: !!user.profileComplete,
      hasActiveSubscription: !!activeSub,
      subscriptionRenewsAt: activeSub ? toDate(activeSub.data().currentPeriodEnd)?.toISOString() || null : null,
      photo: user.photo || null,
      answers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual renew — stands in for Stripe's own auto-renewal until real billing
// is wired up. Extends from the current expiry (not from "now") so
// renewing a few days early, before it's actually lapsed, doesn't throw
// away the days still remaining.
router.post('/subscription/renew', attendeeAuth, async (req, res) => {
  try {
    const subSnap = await db.collection('subscriptions').where('userId', '==', req.user.id).get();
    if (subSnap.empty) return res.status(400).json({ error: 'No subscription on file to renew.' });

    const latest = subSnap.docs.sort((a, b) => (b.data().updatedAt?.toMillis?.() || 0) - (a.data().updatedAt?.toMillis?.() || 0))[0];
    const currentEnd = toDate(latest.data().currentPeriodEnd) || new Date();
    const base = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

    await latest.ref.set({
      status: 'active',
      currentPeriodEnd: admin.firestore.Timestamp.fromDate(newEnd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ success: true, renewsAt: newEnd.toISOString() });
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
    // 9 or 10 digits — NZ mobiles are 9, most other countries we see are 10.
    if ('phone' in req.body && req.body.phone && !/^\d{9,10}$/.test(req.body.phone)) {
      return res.status(400).json({ error: 'Enter a valid phone number.' });
    }

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
        // Sent as the actual 7pm-NZT dinner-start instant (not midnight UTC
        // of the calendar day) so the client can use it directly as a
        // countdown target without having to know anything about NZ's
        // timezone/DST itself.
        date: dinnerDate ? nzTime(dinnerDate, 19, 0).toISOString() : null,
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
          booking_id: latestDoc.id,
          // tuesdayDate is the normalized 'YYYY-MM-DD' chosen at signup — the
          // dinners collection doc (and its `date` field) only gets created
          // once matching happens, but the dashboard's reveal countdowns are
          // timed off this date regardless of match status, so it needs to
          // go out even for an unmatched booking.
          date: booking.tuesdayDate ? nzTime(booking.tuesdayDate, 19, 0).toISOString() : null,
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
    const infoByUserId = {};
    await Promise.all(otherMembers.map(async (d) => {
      const userId = d.data().user_id;
      const userSnap = await db.collection('users').doc(userId).get();
      infoByUserId[userId] = userSnap.exists ? userSnap.data() : {};
    }));

    // Name and photo ship either way — the client is what blurs/masks both
    // until `revealed` flips true, same pattern as the group chat. Country
    // only ever renders as a flag icon next to the name, never as text, so
    // it isn't gated the same way — the job-for-a-kid answer is unmasked
    // from the start too.
    const revealed = new Date() >= fullRevealAt(dinnerDate);
    const glimpse = otherMembers.map(d => {
      const m = d.data();
      const info = infoByUserId[m.user_id] || {};
      return {
        user_id: m.user_id,
        career_kid: m.career_description,
        photo: info.photo || null,
        first_name: info.firstName || null,
        country: info.country || null,
      };
    });

    res.json({ glimpse, revealed });
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

// Refund the attendee's one-time booking fee, if there's an unrefunded
// payment on file. Active subscriptions aren't touched here — cancelling
// one dinner doesn't cancel the membership. Shared between cancelling a
// matched booking and cancelling a still-pending one — a pending booking
// already has a payment attached (paid at signup, before matching), so
// the same refund needs to happen either way.
async function refundLatestPayment(uid) {
  // where() + orderBy() on different fields needs a composite index, so
  // filter here and sort in memory instead.
  const paymentSnap = await db.collection('payments')
    .where('userId', '==', uid)
    .where('status', '==', 'completed')
    .get();
  if (paymentSnap.empty) return false;

  const paymentDoc = paymentSnap.docs.slice().sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0))[0];
  const payment = paymentDoc.data();
  if (!payment.stripePaymentIntentId) return false;

  try {
    await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId });
    await paymentDoc.ref.set({ status: 'refunded', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (refundErr) {
    console.error(`Refund failed for user ${uid}, payment ${paymentDoc.id}:`, refundErr.message);
    return false;
  }
}

router.post('/cancel/:tableId', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const memberRef = db.collection('tableMembers').doc(`${tableId}_${req.user.id}`);
    const [memberSnap, tableSnap] = await Promise.all([memberRef.get(), db.collection('tables').doc(tableId).get()]);
    if (!memberSnap.exists || !tableSnap.exists) return res.status(404).json({ error: 'Not found' });

    const table = tableSnap.data();
    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);
    const hoursUntil = dinnerDate ? (nzTime(dinnerDate, 19, 0) - new Date()) / (1000 * 60 * 60) : Infinity;

    if (hoursUntil < 48) {
      return res.status(400).json({ error: 'Cancellations must be made at least 48 hours before dinner.' });
    }

    await memberRef.delete();

    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', req.user.id)
      .where('tableId', '==', tableId)
      .get();
    await Promise.all(bookingSnap.docs.map(d => d.ref.set({ matched: false, tableId: null, dinnerId: null }, { merge: true })));

    const refunded = await refundLatestPayment(req.user.id);

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

// Cancelling before a table's even been assigned — the existing /cancel
// route above assumes a confirmed table/tableMembers doc exists, which a
// pending signup doesn't have yet. No 48h cutoff here: nothing's been
// reserved on the restaurant side yet, so there's nothing time-sensitive
// to protect against.
router.post('/cancel-pending/:bookingId', attendeeAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const ref = db.collection('bookings').doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const booking = snap.data();
    if (booking.userId !== req.user.id) return res.status(403).json({ error: 'Not your booking' });
    if (booking.matched) return res.status(400).json({ error: 'This booking is already matched — cancel it from the dashboard instead.' });

    await ref.delete();
    const refunded = await refundLatestPayment(req.user.id);

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

// Deletes the account and everything tied to it: cancels any live Stripe
// subscription first (otherwise the user keeps being billed after their
// data is gone), then wipes every Firestore doc keyed to this uid, then
// removes the Firebase Auth account itself. Table group chat messages are
// left in place since they're shared history other members still see.
router.delete('/account', attendeeAuth, async (req, res) => {
  const uid = req.user.id;
  try {
    const subsSnap = await db.collection('subscriptions').where('userId', '==', uid).get();
    await Promise.all(subsSnap.docs.map(async (d) => {
      const sub = d.data();
      if (!d.id.startsWith('sim_') && ['active', 'trialing'].includes(sub.status)) {
        try { await stripe.subscriptions.cancel(d.id); } catch (e) { console.error('Stripe cancel failed for', d.id, e.message); }
      }
    }));

    const [
      bookingsSnap, paymentsSnap, tableMembersSnap, dinnerPhotosSnap,
      connectionsA, connectionsB, requestsTo, requestsFrom,
      dismissalsBy, dismissalsOf, pushSubsSnap,
    ] = await Promise.all([
      db.collection('bookings').where('userId', '==', uid).get(),
      db.collection('payments').where('userId', '==', uid).get(),
      db.collection('tableMembers').where('user_id', '==', uid).get(),
      db.collection('dinnerPhotos').where('userId', '==', uid).get(),
      db.collection('connections').where('user1Id', '==', uid).get(),
      db.collection('connections').where('user2Id', '==', uid).get(),
      db.collection('connectionRequests').where('toUserId', '==', uid).get(),
      db.collection('connectionRequests').where('fromUserId', '==', uid).get(),
      db.collection('connectionDismissals').where('dismisserId', '==', uid).get(),
      db.collection('connectionDismissals').where('targetId', '==', uid).get(),
      db.collection('pushSubscriptions').where('userId', '==', uid).get(),
    ]);

    const connectionDocs = [...connectionsA.docs, ...connectionsB.docs];
    const connectionIds = connectionDocs.map((d) => d.id);
    const dmSnaps = await Promise.all(
      connectionIds.map((id) => db.collection('dmMessages').where('connectionId', '==', id).get())
    );

    const refs = [
      db.collection('users').doc(uid),
      ...subsSnap.docs.map((d) => d.ref),
      ...bookingsSnap.docs.map((d) => d.ref),
      ...paymentsSnap.docs.map((d) => d.ref),
      ...tableMembersSnap.docs.map((d) => d.ref),
      ...dinnerPhotosSnap.docs.map((d) => d.ref),
      ...connectionDocs.map((d) => d.ref),
      ...requestsTo.docs.map((d) => d.ref),
      ...requestsFrom.docs.map((d) => d.ref),
      ...dismissalsBy.docs.map((d) => d.ref),
      ...dismissalsOf.docs.map((d) => d.ref),
      ...pushSubsSnap.docs.map((d) => d.ref),
      ...dmSnaps.flatMap((snap) => snap.docs.map((d) => d.ref)),
    ];

    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await auth.deleteUser(uid).catch((e) => console.error('Auth user delete failed for', uid, e.message));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
