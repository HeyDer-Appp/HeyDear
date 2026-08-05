const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const emailService = require('../../services/email');
const { bookingToPerson } = require('../../utils/bookingView');

function dinnerDateKey(dinner) {
  return dinner.date.toDate().toISOString().split('T')[0];
}

router.get('/unmatched/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const dinnerSnap = await db.collection('dinners').doc(dinnerId).get();
    if (!dinnerSnap.exists) return res.status(404).json({ error: 'Dinner not found' });

    const dateKey = dinnerDateKey(dinnerSnap.data());
    // Two equality filters, sorted in memory — avoids depending on a
    // composite index (tuesdayDate + matched + submittedAt) that doesn't
    // exist by default on a fresh Firestore project.
    const snap = await db.collection('bookings')
      .where('tuesdayDate', '==', dateKey)
      .where('matched', '==', false)
      .get();

    const unmatched = snap.docs
      .map(d => ({ doc: d, data: d.data() }))
      .sort((a, b) => (a.data.submittedAt?.toMillis?.() || 0) - (b.data.submittedAt?.toMillis?.() || 0))
      .map(({ doc, data }) => bookingToPerson(doc.id, data));
    res.json({ unmatched, dinner: { id: dinnerSnap.id, ...dinnerSnap.data(), date: dinnerSnap.data().date.toDate().toISOString() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/tables/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    // where() + orderBy() on different fields needs a composite index, so
    // filter here and sort in memory instead.
    const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerId).get();
    const sortedTableDocs = tablesSnap.docs.slice().sort((a, b) => (a.data().table_number || 0) - (b.data().table_number || 0));

    const tables = await Promise.all(sortedTableDocs.map(async (t) => {
      const table = t.data();
      const [restaurantSnap, membersSnap] = await Promise.all([
        table.restaurantId ? db.collection('restaurants').doc(table.restaurantId).get() : null,
        db.collection('tableMembers').where('tableId', '==', t.id).get(),
      ]);
      const restaurant = restaurantSnap?.data();

      const sortedMemberDocs = membersSnap.docs.slice().sort((a, b) => (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));
      const members = sortedMemberDocs.map(m => {
        const data = m.data();
        return {
          id: m.id,
          user_id: data.user_id,
          confirmed: data.confirmed,
          unique_fact: data.unique_fact,
          held_over: data.held_over,
          no_show_risk: data.no_show_risk,
          admin_note: data.admin_note,
          first_name: data.firstName,
          last_name: data.lastName,
          gender: data.gender,
          country: data.country,
          dob: data.dob,
          intent: data.intent,
          personality: data.personality,
          budget: data.budget,
          reliability_score: data.reliability_score,
          dietary: data.dietary,
          group_role: data.group_role,
          conflict_style: data.conflict_style,
          connection_trigger: data.connection_trigger,
          social_recharge: data.social_recharge,
          conversation_avoid: data.conversation_avoid,
          first_meeting_style: data.first_meeting_style,
          career_description: data.career_description,
        };
      });

      return {
        id: t.id,
        ...table,
        restaurant_name: restaurant?.name,
        restaurant_address: restaurant?.address,
        members,
      };
    }));

    res.json({ tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tables', adminAuth, async (req, res) => {
  try {
    const { dinnerId, restaurantId, tableNumber } = req.body;
    const ref = await db.collection('tables').add({
      dinnerId,
      restaurantId: restaurantId || null,
      table_number: tableNumber || null,
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    res.json({ table: { id: ref.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Assigns (or clears) which restaurant a table is dining at — the field
// already existed on the table doc and every read path already resolves
// restaurant_name/address from it, this was just missing a way to set it.
router.patch('/tables/:tableId', adminAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { restaurantId, tableNumber } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if ('restaurantId' in req.body) updates.restaurantId = restaurantId || null;
    if (tableNumber !== undefined) updates.table_number = tableNumber;

    const ref = db.collection('tables').doc(tableId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Table not found' });

    await ref.set(updates, { merge: true });

    let restaurant = null;
    if (updates.restaurantId) {
      const restSnap = await db.collection('restaurants').doc(updates.restaurantId).get();
      restaurant = restSnap.exists ? restSnap.data() : null;
    }

    res.json({
      table: { id: ref.id, ...snap.data(), ...updates },
      restaurant_name: restaurant?.name || null,
      restaurant_address: restaurant?.address || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tables/:tableId/assign', adminAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { userId } = req.body;

    const memberRef = db.collection('tableMembers').doc(`${tableId}_${userId}`);
    const existing = await memberRef.get();
    if (existing.exists) return res.json({ success: true });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    if (!tableSnap.exists) return res.status(404).json({ error: 'Table not found' });
    const table = tableSnap.data();

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dateKey = dinnerDateKey(dinnerSnap.data());

    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', userId)
      .where('tuesdayDate', '==', dateKey)
      .where('matched', '==', false)
      .limit(1)
      .get();
    if (bookingSnap.empty) return res.status(404).json({ error: 'No pending booking found for this person on this date' });

    const bookingDoc = bookingSnap.docs[0];
    const person = bookingToPerson(bookingDoc.id, bookingDoc.data());

    await Promise.all([
      memberRef.set({
        tableId,
        dinnerId: table.dinnerId,
        user_id: userId,
        confirmed: false,
        unique_fact: null,
        held_over: false,
        no_show_risk: false,
        admin_note: null,
        email_confirmation_sent: false,
        email_group_found_sent: false,
        email_glimpse_sent: false,
        email_venue_sent: false,
        email_reminder_sent: false,
        email_feedback_sent: false,
        firstName: person.first_name,
        lastName: person.last_name,
        email: person.email,
        phone: person.phone,
        gender: person.gender,
        country: person.country,
        dob: person.dob,
        intent: person.intent,
        personality: person.personality,
        budget: person.budget,
        reliability_score: person.reliability_score,
        dietary: person.dietary,
        group_role: person.group_role,
        conflict_style: person.conflict_style,
        connection_trigger: person.connection_trigger,
        social_recharge: person.social_recharge,
        conversation_avoid: person.conversation_avoid,
        first_meeting_style: person.first_meeting_style,
        career_description: person.career_description,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      bookingDoc.ref.set({ matched: true, tableId, dinnerId: table.dinnerId }, { merge: true }),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/tables/:tableId/members/:userId', adminAuth, async (req, res) => {
  try {
    const { tableId, userId } = req.params;
    await db.collection('tableMembers').doc(`${tableId}_${userId}`).delete();

    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', userId)
      .where('tableId', '==', tableId)
      .get();
    await Promise.all(bookingSnap.docs.map(d => d.ref.set({ matched: false, tableId: null, dinnerId: null }, { merge: true })));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tables/:tableId/confirm', adminAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const tableRef = db.collection('tables').doc(tableId);
    const tableSnap = await tableRef.get();
    if (!tableSnap.exists) return res.status(404).json({ error: 'Table not found' });

    await tableRef.set({
      status: 'confirmed',
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      confirmedBy: req.admin.id,
    }, { merge: true });

    const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
    const batch = db.batch();
    membersSnap.docs.forEach(d => batch.set(d.ref, { confirmed: true }, { merge: true }));
    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/members/:memberId', adminAuth, async (req, res) => {
  try {
    const { held_over, no_show_risk, admin_note, unique_fact } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (held_over !== undefined) updates.held_over = held_over;
    if (no_show_risk !== undefined) updates.no_show_risk = no_show_risk;
    if (admin_note !== undefined) updates.admin_note = admin_note;
    if (unique_fact !== undefined) updates.unique_fact = unique_fact;

    if (Object.keys(updates).length === 1) return res.status(400).json({ error: 'Nothing to update' });

    const ref = db.collection('tableMembers').doc(req.params.memberId);
    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    res.json({ member: { id: ref.id, ...snap.data() } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/email/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { tableId, userId } = req.body;

    let targets = [];
    if (userId) {
      const snap = await db.collection('tableMembers').doc(`${tableId}_${userId}`).get();
      if (snap.exists) targets = [{ ref: snap.ref, ...snap.data() }];
    } else if (tableId) {
      const snap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
      targets = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));
    }

    const [tableSnap, membersSnap] = tableId
      ? await Promise.all([
          db.collection('tables').doc(tableId).get(),
          db.collection('tableMembers').where('tableId', '==', tableId).get(),
        ])
      : [null, null];
    const table = tableSnap?.data();
    const [restaurantSnap, dinnerSnap] = table
      ? await Promise.all([
          table.restaurantId ? db.collection('restaurants').doc(table.restaurantId).get() : null,
          db.collection('dinners').doc(table.dinnerId).get(),
        ])
      : [null, null];
    const restaurant = restaurantSnap?.data() || {};
    const dinnerDate = dinnerSnap?.data()?.date;

    let sent = 0;
    const emailField = `email_${type}_sent`;

    for (const target of targets) {
      try {
        const targetForEmail = { first_name: target.firstName, email: target.email };
        if (type === 'group_found') {
          await emailService.sendGroupFoundEmail(targetForEmail, { date: dinnerDate.toDate() });
        } else if (type === 'venue') {
          await emailService.sendVenueRevealEmail(targetForEmail, {
            name: restaurant.name,
            address: restaurant.address,
            booking_name: restaurant.bookingName,
            booking_time: restaurant.bookingTime,
            menu_price_min: restaurant.menuPriceMin,
            menu_price_max: restaurant.menuPriceMax,
          }, {});
        } else if (type === 'reminder') {
          await emailService.sendReminderEmail(targetForEmail, {
            name: restaurant.name,
            address: restaurant.address,
            booking_name: restaurant.bookingName,
            booking_time: restaurant.bookingTime,
          });
        } else if (type === 'feedback') {
          await emailService.sendFeedbackEmail(targetForEmail, { id: table?.dinnerId }, restaurant.name);
        } else if (type === 'glimpse') {
          const members = (membersSnap?.docs || []).map(m => {
            const md = m.data();
            return {
              flagEmoji: countryToFlag(md.country),
              genderEmoji: md.gender === 'Female' ? '👩' : md.gender === 'Male' ? '👨' : '🧑',
              uniqueFact: md.unique_fact,
            };
          });
          await emailService.sendGroupGlimpseEmail(targetForEmail, members, dinnerDate?.toDate());
        }

        await target.ref.set({ [emailField]: true }, { merge: true });
        sent++;
      } catch (emailErr) {
        console.error(`Failed to send ${type} email to ${target.email}:`, emailErr.message);
      }
    }

    res.json({ sent, total: targets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function countryToFlag(country) {
  if (!country) return '🌏';
  const flags = {
    'New Zealand': '🇳🇿', 'Australia': '🇦🇺', 'India': '🇮🇳',
    'United Kingdom': '🇬🇧', 'USA': '🇺🇸', 'United States': '🇺🇸',
    'China': '🇨🇳', 'Philippines': '🇵🇭', 'South Africa': '🇿🇦',
    'Canada': '🇨🇦', 'Fiji': '🇫🇯', 'Samoa': '🇼🇸', 'Tonga': '🇹🇴',
  };
  return flags[country] || '🌏';
}

module.exports = router;
