const express = require('express');
const router = express.Router();
const { admin, db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const emailService = require('../../services/email');
const pushService = require('../../services/push');
const { bookingToPerson } = require('../../utils/bookingView');
const { matchGroups, validateTable } = require('../../services/matching');
const { buildInsights, publicInsights } = require('../../services/matchingLearning');

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
      // paid === false is a booking still sitting mid-checkout (or an
      // abandoned one) — excluded so it can't be seated at a real table
      // before anyone's actually paid for it. paid === undefined is a
      // pre-existing booking from before this field existed, still shown.
      .filter(({ data }) => data.paid !== false)
      .sort((a, b) => (a.data.submittedAt?.toMillis?.() || 0) - (b.data.submittedAt?.toMillis?.() || 0))
      .map(({ doc, data }) => bookingToPerson(doc.id, data));
    res.json({ unmatched, dinner: { id: dinnerSnap.id, ...dinnerSnap.data(), date: dinnerSnap.data().date.toDate().toISOString() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Every confirmed table across every dinner, newest-relevant first — this is
// the admin's communications hub: no dinner has to be picked first, since a
// table shows up here the moment it's confirmed in the Matching workspace.
router.get('/confirmed-tables', adminAuth, async (req, res) => {
  try {
    const tablesSnap = await db.collection('tables').where('status', '==', 'confirmed').get();
    const tables = await Promise.all(tablesSnap.docs.map(async (t) => {
      const table = t.data();
      const [dinnerSnap, restaurantSnap, membersSnap] = await Promise.all([
        db.collection('dinners').doc(table.dinnerId).get(),
        table.restaurantId ? db.collection('restaurants').doc(table.restaurantId).get() : null,
        db.collection('tableMembers').where('tableId', '==', t.id).get(),
      ]);
      const dinner = dinnerSnap.exists ? dinnerSnap.data() : null;
      const restaurant = restaurantSnap?.data();

      const sortedMemberDocs = membersSnap.docs.slice().sort((a, b) => (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));
      const members = sortedMemberDocs.map(m => {
        const data = m.data();
        return {
          id: m.id,
          user_id: data.user_id,
          first_name: data.firstName,
          last_name: data.lastName,
          gender: data.gender,
          country: data.country,
          dob: data.dob,
          dietary: data.dietary,
          dietary_other: data.dietary_other,
          email_group_found_sent: !!data.email_group_found_sent,
          email_glimpse_sent: !!data.email_glimpse_sent,
          email_venue_sent: !!data.email_venue_sent,
          email_reminder_sent: !!data.email_reminder_sent,
          email_feedback_sent: !!data.email_feedback_sent,
        };
      });

      return {
        id: t.id,
        dinnerId: table.dinnerId,
        dinner_date: dinner?.date ? dinner.date.toDate().toISOString() : null,
        city: dinner?.city || 'Auckland',
        dinner_status: dinner?.status || null,
        table_number: table.table_number,
        restaurant_name: restaurant?.name || null,
        restaurant_address: restaurant?.address || null,
        booking_name: table.bookingName || null,
        members,
      };
    }));

    tables.sort((a, b) => new Date(a.dinner_date || 0) - new Date(b.dinner_date || 0));
    res.json({ tables });
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
          dietary_other: data.dietary_other,
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
        booking_name: table.bookingName || null,
        members,
        ...validateTable(members),
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

// Assigns (or clears) which restaurant a table is dining at, and the
// booking name it's held under — a booking name belongs to this specific
// table's reservation, not the restaurant itself, since one restaurant can
// host several different HeyDer tables (each under a different host name)
// on the same night.
router.patch('/tables/:tableId', adminAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { restaurantId, tableNumber, bookingName, name } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if ('restaurantId' in req.body) updates.restaurantId = restaurantId || null;
    if (tableNumber !== undefined) updates.table_number = tableNumber;
    if ('bookingName' in req.body) updates.bookingName = bookingName || null;
    if (typeof name === 'string') updates.name = name.trim().slice(0, 40) || null;

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

// Removes an empty, unconfirmed group.
router.delete('/tables/:tableId', adminAuth, async (req, res) => {
  try {
    const ref = db.collection('tables').doc(req.params.tableId);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ success: true });
    if (snap.data().status === 'confirmed') return res.status(400).json({ error: 'Unlock the group first.' });
    const members = await db.collection('tableMembers').where('tableId', '==', ref.id).get();
    if (!members.empty) return res.status(400).json({ error: 'Move the people out first.' });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Everyone who dropped out of this dinner: cancelled bookings (before or after
// being placed) plus seated diners who answered "not coming" on the night.
router.get('/cancelled/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const dinnerSnap = await db.collection('dinners').doc(dinnerId).get();
    if (!dinnerSnap.exists) return res.status(404).json({ error: 'Dinner not found' });
    const dateKey = dinnerDateKey(dinnerSnap.data());

    const [byDate, byId, tablesSnap] = await Promise.all([
      db.collection('cancellations').where('tuesdayDate', '==', dateKey).get(),
      db.collection('cancellations').where('dinnerId', '==', dinnerId).get(),
      db.collection('tables').where('dinnerId', '==', dinnerId).get(),
    ]);
    const seen = new Set();
    const iso = (t) => (t && t.toDate ? t.toDate().toISOString() : null);
    const out = [];
    for (const d of [...byDate.docs, ...byId.docs]) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      const c = d.data();
      out.push({
        id: d.id, user_id: c.userId,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown',
        email: c.email || null, phone: c.phone || null,
        reason: c.kind === 'placed' ? 'Cancelled after being placed' : 'Cancelled before being placed',
        table_name: c.tableName || null, refunded: !!c.refunded, at: iso(c.cancelledAt),
      });
    }

    // Seated but said "not coming" in the app on the night
    const tableName = Object.fromEntries(tablesSnap.docs.map(t => [t.id, t.data().name || (t.data().table_number ? 'Table ' + t.data().table_number : null)]));
    const membersSnap = await db.collection('tableMembers').where('dinnerId', '==', dinnerId).get();
    for (const m of membersSnap.docs) {
      const md = m.data();
      if (md.rsvpAttending !== false) continue;
      out.push({
        id: m.id, user_id: md.user_id,
        name: [md.firstName, md.lastName].filter(Boolean).join(' ') || 'Unknown',
        email: md.email || null, phone: md.phone || null,
        reason: 'Said not coming', table_name: tableName[md.tableId] || null, refunded: null, at: null,
      });
    }
    out.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    res.json({ cancelled: out });
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
    if (bookingDoc.data().paid === false) {
      return res.status(400).json({ error: "This booking hasn't been paid for yet — can't seat them until it is." });
    }
    await seatBooking(tableId, table.dinnerId, userId, bookingDoc);

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

async function confirmTableInternal(tableId, adminId) {
  const tableRef = db.collection('tables').doc(tableId);
  const tableSnap = await tableRef.get();
  if (!tableSnap.exists) return false;

  await tableRef.set({
    status: 'confirmed',
    confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    confirmedBy: adminId,
  }, { merge: true });

  const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
  const batch = db.batch();
  membersSnap.docs.forEach(d => batch.set(d.ref, { confirmed: true }, { merge: true }));
  await batch.commit();

  const table = tableSnap.data();
  const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
  const dinnerDate = dinnerSnap.exists ? dinnerSnap.data().date.toDate() : null;
  const formattedDate = dinnerDate
    ? dinnerDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' })
    : 'Tuesday';
  pushService.sendToTable(tableId, pushService.notifications.groupFound(formattedDate)).catch(() => {});
  return true;
}

router.post('/tables/:tableId/confirm', adminAuth, async (req, res) => {
  try {
    const ok = await confirmTableInternal(req.params.tableId, req.admin.id);
    if (!ok) return res.status(404).json({ error: 'Table not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/tables/:tableId/unconfirm', adminAuth, async (req, res) => {
  try {
    const { tableId } = req.params;

    const tableRef = db.collection('tables').doc(tableId);
    const tableSnap = await tableRef.get();
    if (!tableSnap.exists) return res.status(404).json({ error: 'Table not found' });

    await tableRef.set({
      status: 'open',
      confirmedAt: admin.firestore.FieldValue.delete(),
      confirmedBy: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    const membersSnap = await db.collection('tableMembers').where('tableId', '==', tableId).get();
    const batch = db.batch();
    membersSnap.docs.forEach(d => batch.set(d.ref, { confirmed: false }, { merge: true }));
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
            booking_name: table.bookingName,
            booking_time: restaurant.bookingTime,
            menu_price_min: restaurant.menuPriceMin,
            menu_price_max: restaurant.menuPriceMax,
          }, {});
        } else if (type === 'reminder') {
          await emailService.sendReminderEmail(targetForEmail, {
            name: restaurant.name,
            address: restaurant.address,
            booking_name: table.bookingName,
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

function memberDocFor(tableId, dinnerId, userId, person) {
  return {
    tableId,
    dinnerId,
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
    dietary_other: person.dietary_other,
    group_role: person.group_role,
    conflict_style: person.conflict_style,
    connection_trigger: person.connection_trigger,
    social_recharge: person.social_recharge,
    conversation_avoid: person.conversation_avoid,
    first_meeting_style: person.first_meeting_style,
    career_description: person.career_description,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// ── Automatic group allocation ────────────────────────────────────────────────

const GROUP_NAMES = ['Bali', 'Tokyo', 'Lisbon', 'Rome', 'Kyoto', 'Oslo', 'Cairo', 'Lima', 'Havana', 'Seoul', 'Athens', 'Dublin', 'Vienna', 'Prague', 'Cusco', 'Hanoi', 'Marrakech', 'Santorini', 'Bergen', 'Porto', 'Tulum', 'Zurich', 'Sydney', 'Paris'];

async function seatBooking(tableId, dinnerId, userId, bookingDoc) {
  const person = bookingToPerson(bookingDoc.id, bookingDoc.data());
  await Promise.all([
    db.collection('tableMembers').doc(`${tableId}_${userId}`).set(memberDocFor(tableId, dinnerId, userId, person)),
    bookingDoc.ref.set({ matched: true, tableId, dinnerId }, { merge: true }),
  ]);
}

// What the learning step has found so far, in plain language.
router.get('/insights', adminAuth, async (req, res) => {
  try {
    res.json({ insights: publicInsights(await buildInsights()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Builds the groups for a dinner from everyone still unplaced, following the
// allocation rules. Tables already confirmed are left alone; any unconfirmed
// draft tables are cleared and rebuilt (people return to the pool first, so a
// re-run reshuffles everyone who isn't locked in).
router.post('/auto/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const useLearning = req.body?.useLearning !== false;
    const seed = Number.isFinite(req.body?.seed) ? req.body.seed : Math.floor(Math.random() * 1e6);

    const dinnerSnap = await db.collection('dinners').doc(dinnerId).get();
    if (!dinnerSnap.exists) return res.status(404).json({ error: 'Dinner not found' });
    const dateKey = dinnerDateKey(dinnerSnap.data());

    const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerId).get();
    const openTables = tablesSnap.docs.filter((d) => d.data().status !== 'confirmed');
    const confirmedTables = tablesSnap.docs.filter((d) => d.data().status === 'confirmed');

    // 1. Put everyone from the draft tables back in the pool.
    for (const t of openTables) {
      const members = await db.collection('tableMembers').where('tableId', '==', t.id).get();
      const bookings = await db.collection('bookings').where('tableId', '==', t.id).get();
      await Promise.all([
        ...members.docs.map((m) => m.ref.delete()),
        ...bookings.docs.map((b) => b.ref.set({ matched: false, tableId: null, dinnerId: null }, { merge: true })),
      ]);
    }
    await Promise.all(openTables.map((t) => t.ref.delete()));

    // 2. Everyone unplaced and paid for (people held over to next week are skipped).
    const poolSnap = await db.collection('bookings').where('tuesdayDate', '==', dateKey).where('matched', '==', false).get();
    const pool = poolSnap.docs.filter((d) => d.data().paid !== false && !d.data().held_over);
    if (!pool.length) return res.json({ tables: 0, placed: 0, unplaced: [], warnings: [], note: 'Nobody is waiting to be placed.' });
    const people = pool.map((d) => bookingToPerson(d.id, d.data()));
    const bookingByUser = Object.fromEntries(pool.map((d) => [d.data().userId, d]));

    // 3. Learning: history of who has met + what makes tables work.
    let insights = null;
    if (useLearning) insights = await buildInsights().catch(() => null);
    const result = matchGroups(people, {
      seed,
      history: insights?.history || null,
      learnedFn: insights?.learnedFn || null,
    });

    // 4. Create the tables and seat everyone.
    const usedNames = new Set(confirmedTables.map((t) => t.data().name).filter(Boolean));
    const nextName = () => GROUP_NAMES.find((n) => !usedNames.has(n)) || `Group ${usedNames.size + 1}`;
    let number = Math.max(0, ...confirmedTables.map((t) => t.data().table_number || 0));
    const created = [];
    for (const memberIds of result.tables) {
      number += 1;
      const name = nextName(); usedNames.add(name);
      const ref = await db.collection('tables').add({
        dinnerId, restaurantId: null, table_number: number, name, bookingName: `HeyDer ${name}`,
        status: 'open', autoAllocated: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      for (const uid of memberIds) await seatBooking(ref.id, dinnerId, uid, bookingByUser[uid]);
      created.push(ref.id);
    }

    res.json({
      tables: created.length,
      placed: result.tables.reduce((n, t) => n + t.length, 0),
      unplaced: result.unplaced.map((u) => ({ ...u, name: (people.find((p) => p.id === u.id)?.first_name) || '' })),
      warnings: result.warnings,
      score: result.score,
      learning: insights?.learnedFn ? { responses: insights.responses } : { responses: insights?.responses || 0, note: 'Not enough feedback yet — rules only.' },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not build the groups' });
  }
});

// Locks in every draft table that has people in it, in one go.
router.post('/confirm-all/:dinnerId', adminAuth, async (req, res) => {
  try {
    const { dinnerId } = req.params;
    const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerId).get();
    let confirmed = 0;
    for (const t of tablesSnap.docs) {
      if (t.data().status === 'confirmed') continue;
      const members = await db.collection('tableMembers').where('tableId', '==', t.id).get();
      if (members.size < 2) continue;
      await confirmTableInternal(t.id, req.admin.id);
      confirmed += 1;
    }
    res.json({ success: true, confirmed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
