const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { QUIZ_QUESTIONS } = require('../services/typeform');
const { quizLimiter } = require('../middleware/rateLimiter');
const { attendeeAuth } = require('../middleware/auth');
const { getCheckoutSession } = require('../services/stripe');
const { ANSWER_FIELDS } = require('../utils/answerFields');

// This is an 18+ event — the client already bounds the date picker and
// blocks navigation on an underage DOB, but that's trivially bypassable by
// posting to this route directly, so it's re-checked here as the real
// enforcement point.
const MIN_AGE_YEARS = 18;

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

function isAdultDob(dobStr) {
  if (!dobStr) return false;
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE_YEARS);
  return dob <= cutoff;
}

router.get('/questions', async (req, res) => {
  try {
    const availableDates = await getAvailableDates();
    const questions = QUIZ_QUESTIONS.map(q => {
      if (q.id === 'CdZldwp5q09o' && availableDates.length > 0) {
        return { ...q, choices: availableDates };
      }
      return q;
    });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const MIN_DATE_CHOICES = 3;

// The next N Tuesdays strictly after today — if today happens to be a
// Tuesday, same-day sign-up is too short notice, so it starts counting
// from next week instead.
function nextTuesdays(count, afterDate = new Date()) {
  const d = new Date(afterDate);
  d.setHours(0, 0, 0, 0);
  let daysUntilTuesday = (2 - d.getDay() + 7) % 7;
  if (daysUntilTuesday === 0) daysUntilTuesday = 7;
  d.setDate(d.getDate() + daysUntilTuesday);

  const dates = [];
  for (let i = 0; i < count; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

async function getAvailableDates() {
  // Single equality filter only (no range + orderBy combo) so this never
  // depends on a composite index existing in Firestore — dinners are few
  // enough to sort in memory.
  const snap = await db.collection('dinners').where('status', '==', 'upcoming').get();
  const now = Date.now();
  const dates = snap.docs
    .map(d => d.data().date.toDate())
    .filter(date => date.getTime() > now);

  // Always offer at least a few real Tuesdays to pick from, even before an
  // admin has explicitly created the dinner row for that week — padding
  // with computed upcoming Tuesdays rather than a stale hardcoded fallback.
  if (dates.length < MIN_DATE_CHOICES) {
    const existingDays = new Set(dates.map(d => d.toDateString()));
    for (const candidate of nextTuesdays(MIN_DATE_CHOICES * 2)) {
      if (dates.length >= MIN_DATE_CHOICES) break;
      if (existingDays.has(candidate.toDateString())) continue;
      dates.push(candidate);
      existingDays.add(candidate.toDateString());
    }
  }

  return dates
    .sort((a, b) => a - b)
    .map(date => date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }));
}

// Builds your profile and books you in for a Tuesday. Requires an
// authenticated Firebase session — the old email-lookup flow (deciding
// whether you're "new" or "returning") is handled client-side now, driven by
// the authenticated user's profileComplete flag instead of a typed email.
router.post('/submit', attendeeAuth, quizLimiter, async (req, res) => {
  try {
    const {
      field_CdZldwp5q09o,
      first_name, last_name, phone, dob, gender, country, photo, city,
      referral_code, stripe_session_id, plan, skip_booking, awaitingPayment,
    } = req.body;

    if (photo !== undefined && photo !== null) {
      if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 800_000) {
        return res.status(400).json({ error: 'Invalid or oversized photo' });
      }
    }

    const userRef = db.collection('users').doc(req.user.id);
    // "Skip for now" builds the profile without reserving a seat at any
    // dinner — a real booking (and the payment it requires) only happens
    // later through BookDinner.jsx, never for free via this shortcut.
    const parsedDate = skip_booking ? null : parseTuesdayDate(field_CdZldwp5q09o);

    // One dinner at a time — re-submitting the same date (e.g. editing an
    // answer mid-flow) is fine, but a different date while an unresolved
    // (still-pending) or upcoming (already-matched) booking exists just
    // creates confusing duplicate bookings on the dashboard.
    if (!skip_booking) {
      const existingBookingsSnap = await db.collection('bookings').where('userId', '==', req.user.id).get();
      for (const doc of existingBookingsSnap.docs) {
        const b = doc.data();
        if (b.tuesdayDate === parsedDate) continue;
        if (b.matched === false) {
          return res.status(409).json({ error: "You already have a dinner booked. Cancel it first if you'd like to book a different Tuesday." });
        }
        if (b.matched === true && b.dinnerId) {
          const dinnerSnap = await db.collection('dinners').doc(b.dinnerId).get();
          const dinnerDate = dinnerSnap.exists ? toDate(dinnerSnap.data().date) : null;
          if (dinnerDate && dinnerDate >= new Date()) {
            return res.status(409).json({ error: "You already have an upcoming dinner booked. Cancel it first if you'd like to book a different Tuesday." });
          }
        }
      }
    }

    const answers = {};
    for (const key of ANSWER_FIELDS) {
      if (req.body[key] !== undefined) answers[key] = req.body[key];
    }
    if (answers.field_OVB7lzEjSl7C !== undefined) {
      answers.field_OVB7lzEjSl7C = Array.isArray(answers.field_OVB7lzEjSl7C)
        ? answers.field_OVB7lzEjSl7C
        : answers.field_OVB7lzEjSl7C ? [answers.field_OVB7lzEjSl7C] : [];
    }

    const result = await db.runTransaction(async (tx) => {
      // Firestore transactions require every read to happen before any
      // write, so all three lookups run first, then every tx.set() after.
      const userSnap = await tx.get(userRef);

      const ambRef = referral_code ? db.collection('ambassadors').doc(referral_code) : null;
      const ambSnap = ambRef ? await tx.get(ambRef) : null;

      const existingBookingSnap = (parsedDate && !skip_booking)
        ? await tx.get(
            db.collection('bookings')
              .where('userId', '==', req.user.id)
              .where('tuesdayDate', '==', parsedDate)
          )
        : null;

      // Normally /auth/attendee/register creates this doc right after
      // signup, but don't hard-fail if it's somehow missing (e.g. that call
      // errored, or this is a legacy account) — self-heal instead of
      // leaving the attendee stuck unable to ever submit their profile.
      const existingUser = userSnap.exists ? userSnap.data() : { email: req.user.email };

      if (!isAdultDob(dob || existingUser.dob)) {
        const err = new Error('This is an 18+ event — please double check your date of birth.');
        err.statusCode = 400;
        throw err;
      }

      const userUpdate = {
        ...answers,
        profileComplete: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (!userSnap.exists) {
        userUpdate.email = req.user.email;
        // Was hardcoded to 'Auckland' regardless of what the signup flow's
        // city picker actually recorded — city never made it into the
        // request at all, so every signup looked identical and the admin
        // panel had nothing to filter or even display.
        userUpdate.city = city || 'Auckland';
        userUpdate.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }
      if (first_name) userUpdate.firstName = first_name;
      if (last_name) userUpdate.lastName = last_name;
      if (phone !== undefined) userUpdate.phone = phone;
      if (dob) userUpdate.dob = dob;
      if (gender) userUpdate.gender = gender;
      if (country) userUpdate.country = country;
      // Kept only on the user doc, not spread into `answers` — a booking or
      // table-member doc doesn't need its own copy of the photo bytes.
      if (photo !== undefined) userUpdate.photo = photo;
      tx.set(userRef, userUpdate, { merge: true });

      if (ambSnap?.exists) {
        tx.set(ambRef.collection('referrals').doc(req.user.id), {
          userId: req.user.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      if (skip_booking) {
        return { bookingRef: null, mergedUser: { ...existingUser, ...userUpdate, id: req.user.id } };
      }

      const isNewBooking = !existingBookingSnap || existingBookingSnap.empty;
      const bookingRef = isNewBooking ? db.collection('bookings').doc() : existingBookingSnap.docs[0].ref;

      const bookingUpdate = {
        userId: req.user.id,
        tuesdayDate: parsedDate,
        firstName: userUpdate.firstName || existingUser.firstName,
        lastName: userUpdate.lastName || existingUser.lastName,
        email: existingUser.email,
        phone: userUpdate.phone ?? existingUser.phone,
        dob: userUpdate.dob || existingUser.dob,
        gender: userUpdate.gender || existingUser.gender,
        country: userUpdate.country || existingUser.country,
        city: userUpdate.city || existingUser.city || 'Auckland',
        ...answers,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      // Every query that finds "unmatched" bookings filters on matched===false
      // explicitly — Firestore won't match that against a missing field, so a
      // new booking has to set it, not just leave it undefined. Only set on
      // creation though: re-submitting shouldn't un-match an already-seated booking.
      if (isNewBooking) {
        bookingUpdate.matched = false;
        bookingUpdate.tableId = null;
        bookingUpdate.dinnerId = null;
        // Set once at creation, then left alone — a booking created while
        // heading to Stripe (awaitingPayment: true) stays unpaid until the
        // webhook confirms the charge actually went through; every other
        // caller (subscribed-confirm, test-mode, the post-redirect resubmit)
        // needs no separate payment step, so it's paid immediately.
        bookingUpdate.paid = !awaitingPayment;
      }
      tx.set(bookingRef, bookingUpdate, { merge: true });

      return { bookingRef, mergedUser: { ...existingUser, ...userUpdate, id: req.user.id } };
    });

    if (skip_booking) {
      return res.json({
        success: true,
        userId: req.user.id,
        message: "You're in. Book a dinner whenever you're ready.",
      });
    }

    if (stripe_session_id) {
      await reconcileStripeSession(req.user.id, stripe_session_id, result.bookingRef);
    } else if (plan === 'subscription') {
      // Test-mode booking (no Stripe key configured) — there's no real
      // checkout session to reconcile a subscription from, so choosing
      // "Monthly membership" here previously just vanished: the booking
      // went through as if it were a one-time reservation and no
      // subscription record was ever created, so the very next booking
      // asked for payment again. Simulate what a real Stripe subscription
      // would have produced instead.
      await db.collection('subscriptions').doc(`sim_${req.user.id}`).set({
        userId: req.user.id,
        plan: 'monthly',
        status: 'active',
        simulated: true,
        currentPeriodEnd: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    res.json({
      success: true,
      userId: req.user.id,
      message: "You're in. We'll be in touch once your group is ready.",
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Saves whatever's been filled in so far while the attendee is still
// building their profile — unlike /submit, this never requires every
// required field to be present and never marks profileComplete or touches
// bookings. Lets someone close the tab mid-profile and pick up where they
// left off instead of starting over.
router.patch('/autosave', attendeeAuth, async (req, res) => {
  try {
    const { phone, dob, gender, country, photo } = req.body;
    const updates = {};

    for (const key of ANSWER_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.field_OVB7lzEjSl7C !== undefined) {
      updates.field_OVB7lzEjSl7C = Array.isArray(updates.field_OVB7lzEjSl7C)
        ? updates.field_OVB7lzEjSl7C
        : updates.field_OVB7lzEjSl7C ? [updates.field_OVB7lzEjSl7C] : [];
    }
    if (phone !== undefined) updates.phone = phone;
    if (dob) updates.dob = dob;
    if (gender) updates.gender = gender;
    if (country) updates.country = country;
    if (photo !== undefined) {
      if (photo !== null && (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 800_000)) {
        return res.status(400).json({ error: 'Invalid or oversized photo' });
      }
      updates.photo = photo;
    }

    if (!Object.keys(updates).length) return res.json({ success: true });

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('users').doc(req.user.id).set(updates, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function reconcileStripeSession(userId, sessionId, bookingRef) {
  let session = null;
  try {
    session = await getCheckoutSession(sessionId);
  } catch (stripeErr) {
    console.error('Failed to retrieve Stripe session:', stripeErr.message);
    return;
  }

  if (session?.mode === 'subscription' && session.subscription) {
    const sub = session.subscription;
    await db.collection('subscriptions').doc(sub.id).set({
      userId,
      stripeCustomerId: session.customer,
      plan: 'monthly',
      status: sub.status,
      currentPeriodEnd: admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    await db.collection('payments').doc(sessionId).set({
      userId,
      amount: session?.amount_total || 1000,
      currency: session?.currency || 'nzd',
      status: 'completed',
      stripePaymentIntentId: session?.payment_intent || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (bookingRef) {
    await bookingRef.set({ stripeSessionId: sessionId }, { merge: true });
  }
}

function parseTuesdayDate(str) {
  if (!str) return null;
  const months = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  };
  const match = str.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = months[monthName];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = router;
