const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { QUIZ_QUESTIONS } = require('../services/typeform');
const { sendConfirmationEmail } = require('../services/email');
const { quizLimiter } = require('../middleware/rateLimiter');
const { attendeeAuth } = require('../middleware/auth');
const { getCheckoutSession } = require('../services/stripe');

const ANSWER_FIELDS = [
  'field_iunObNMC8bY1', 'field_cqCcs6psQuhE', 'field_CdZldwp5q09o',
  'field_3zmnHXYzZn17', 'field_aIpzE2elktbh', 'field_L6GblNns9C7v',
  'field_LosYJHqrbpKO', 'field_lS4ks7Km1VlA',
  'field_PyYcCusA8b74', 'field_Y8VLrSMSZLmb', 'field_heE41fid4m48',
  'field_H4KwwtKh8sYF', 'field_OqnhJdRIytBz', 'field_1NDB7q3CaeDQ',
  'field_TaGZoiuhOhh2', 'field_TQFTxLhIZnOf', 'field_pCwGXuvIxGTu',
  'field_MQDZqx7wid2f', 'field_Ar4xQbXT6CLh', 'field_OVB7lzEjSl7C',
  'group_role', 'conflict_style', 'connection_trigger',
  'social_recharge', 'conversation_avoid', 'first_meeting_style',
];

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

async function getAvailableDates() {
  const now = admin.firestore.Timestamp.now();
  const snap = await db.collection('dinners')
    .where('status', '==', 'upcoming')
    .where('date', '>', now)
    .orderBy('date', 'asc')
    .get();
  const availableDates = snap.docs.map(d =>
    d.data().date.toDate().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
  );
  if (availableDates.length === 0) {
    availableDates.push('30th June 2026', '7th July 2026');
  }
  return availableDates;
}

// Builds your profile and books you in for a Tuesday. Requires an
// authenticated Firebase session — the old email-lookup flow (deciding
// whether you're "new" or "returning") is handled client-side now, driven by
// the authenticated user's profileComplete flag instead of a typed email.
router.post('/submit', attendeeAuth, quizLimiter, async (req, res) => {
  try {
    const {
      field_CdZldwp5q09o,
      first_name, last_name, phone, dob, gender, country,
      referral_code, stripe_session_id,
    } = req.body;

    const userRef = db.collection('users').doc(req.user.id);
    const parsedDate = parseTuesdayDate(field_CdZldwp5q09o);

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
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('User profile not found — call /auth/attendee/register first');
      const existingUser = userSnap.data();

      const userUpdate = {
        ...answers,
        profileComplete: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (first_name) userUpdate.firstName = first_name;
      if (last_name) userUpdate.lastName = last_name;
      if (phone !== undefined) userUpdate.phone = phone;
      if (dob) userUpdate.dob = dob;
      if (gender) userUpdate.gender = gender;
      if (country) userUpdate.country = country;
      tx.set(userRef, userUpdate, { merge: true });

      if (referral_code) {
        const ambRef = db.collection('ambassadors').doc(referral_code);
        const ambSnap = await tx.get(ambRef);
        if (ambSnap.exists) {
          tx.set(ambRef.collection('referrals').doc(req.user.id), {
            userId: req.user.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      }

      let bookingRef;
      if (parsedDate) {
        const existingBooking = await tx.get(
          db.collection('bookings')
            .where('userId', '==', req.user.id)
            .where('tuesdayDate', '==', parsedDate)
        );
        bookingRef = existingBooking.empty
          ? db.collection('bookings').doc()
          : existingBooking.docs[0].ref;
      } else {
        bookingRef = db.collection('bookings').doc();
      }

      tx.set(bookingRef, {
        userId: req.user.id,
        tuesdayDate: parsedDate,
        firstName: userUpdate.firstName || existingUser.firstName,
        lastName: userUpdate.lastName || existingUser.lastName,
        email: existingUser.email,
        phone: userUpdate.phone ?? existingUser.phone,
        dob: userUpdate.dob || existingUser.dob,
        gender: userUpdate.gender || existingUser.gender,
        country: userUpdate.country || existingUser.country,
        ...answers,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { bookingRef, mergedUser: { ...existingUser, ...userUpdate, id: req.user.id } };
    });

    if (stripe_session_id) {
      await reconcileStripeSession(req.user.id, stripe_session_id, result.bookingRef);
    }

    sendConfirmationEmail(result.mergedUser, answers).catch(console.error);

    res.json({
      success: true,
      userId: req.user.id,
      message: "You're in. We'll be in touch once your group is ready.",
    });
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
