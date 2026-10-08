const express = require('express');
const router = express.Router();
const { admin, db, auth } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');
const banned = require('../../utils/banned');
const { sharedTable } = require('../../services/reportContext');

const iso = (t) => (t && t.toDate ? t.toDate().toISOString() : null);

function personFrom(id, u = {}, extra = {}) {
  return {
    user_id: id,
    name: [u.firstName || u.first_name, u.lastName || u.last_name].filter(Boolean).join(' ') || 'Unknown',
    email: u.email || null,
    phone: u.phone ? `${u.phoneCountryCode && !String(u.phone).startsWith('+') ? u.phoneCountryCode : ''}${u.phone}` : null,
    gender: u.gender || null,
    dob: u.dob || null,
    city: u.city || null,
    banned: !!u.banned,
    ...extra,
  };
}

async function userPerson(uid, extra) {
  if (!uid) return personFrom(null, {}, extra);
  const s = await db.collection('users').doc(uid).get();
  return personFrom(uid, s.exists ? s.data() : {}, { missing: !s.exists, ...extra });
}

// Report list, newest first — open ones on top.
router.get('/', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('safetyReports').get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const against = {};
    all.forEach((r) => { against[r.reportedUserId] = (against[r.reportedUserId] || 0) + 1; });

    const rows = all
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .map((r) => ({
        id: r.id,
        status: r.status || 'open',
        reason: r.reason,
        reporter: r.reporterName || r.reporterEmail || r.reporterId,
        reported: r.reportedName || r.reportedUserId,
        reported_user_id: r.reportedUserId,
        reports_against: against[r.reportedUserId] || 1,
        outcome: r.outcome || null,
        created_at: iso(r.createdAt),
      }));
    rows.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1));
    res.json({ reports: rows, open: rows.filter((r) => r.status === 'open').length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/count', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('safetyReports').get();
    res.json({ open: snap.docs.filter((d) => (d.data().status || 'open') === 'open').length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Everything needed to decide: both people with contact details, what was
// said, other reports on the same person, and the whole table from that dinner.
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('safetyReports').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Report not found' });
    const r = snap.data();
    const when = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();

    const [reporter, reported, others, shared] = await Promise.all([
      userPerson(r.reporterId, { role: 'reporter' }),
      userPerson(r.reportedUserId, { role: 'reported' }),
      db.collection('safetyReports').where('reportedUserId', '==', r.reportedUserId).get(),
      sharedTable(r.reporterId, r.reportedUserId, when),
    ]);

    // The table: stored at filing time when known, otherwise worked out now.
    let tableInfo = null;
    const ctx = r.tableId ? { tableId: r.tableId, dinnerId: r.dinnerId } : shared && { tableId: shared.tableId, dinnerId: shared.dinnerId };
    if (ctx && ctx.tableId) {
      const [t, members, d] = await Promise.all([
        db.collection('tables').doc(ctx.tableId).get(),
        db.collection('tableMembers').where('tableId', '==', ctx.tableId).get(),
        ctx.dinnerId ? db.collection('dinners').doc(ctx.dinnerId).get() : null,
      ]);
      const memberRows = await Promise.all(members.docs.map(async (m) => {
        const md = m.data();
        const u = await db.collection('users').doc(md.user_id).get();
        const merged = { ...md, ...(u.exists ? u.data() : {}) };
        return personFrom(md.user_id, merged, {
          is_reporter: md.user_id === r.reporterId,
          is_reported: md.user_id === r.reportedUserId,
        });
      }));
      tableInfo = {
        table_id: ctx.tableId,
        name: t.exists ? t.data().name || (t.data().table_number ? `Table ${t.data().table_number}` : null) : null,
        dinner_date: d && d.exists && d.data().date.toDate ? d.data().date.toDate().toISOString() : null,
        members: memberRows,
      };
    }

    res.json({
      report: {
        id: snap.id,
        status: r.status || 'open',
        reason: r.reason,
        details: r.details || '',
        created_at: iso(r.createdAt),
        reported_side: r.reportedSide || '',
        admin_note: r.adminNote || '',
        outcome: r.outcome || null,
        resolved_at: iso(r.resolvedAt),
      },
      reporter,
      reported,
      table: tableInfo,
      other_reports: others.docs.filter((d) => d.id !== snap.id).map((d) => ({
        id: d.id, reason: d.data().reason, status: d.data().status || 'open', outcome: d.data().outcome || null, created_at: iso(d.data().createdAt),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Notes while investigating — the reported person's side of the story
// (after speaking to them) and the team's own notes.
router.patch('/:id', adminAuth, async (req, res) => {
  try {
    const { reportedSide, adminNote } = req.body;
    const updates = {};
    if (typeof reportedSide === 'string') updates.reportedSide = reportedSide.slice(0, 4000);
    if (typeof adminNote === 'string') updates.adminNote = adminNote.slice(0, 4000);
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to save' });
    const ref = db.collection('safetyReports').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Report not found' });
    await ref.set(updates, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Takes a banned person off every dinner that hasn't happened yet, so they
// can't turn up at a table. Returns what was removed (refunds are left to
// the admin, who decides case by case).
async function removeFromUpcoming(uid) {
  const todayKey = new Date().toISOString().split('T')[0];
  let tables = 0;
  let bookings = 0;
  const members = await db.collection('tableMembers').where('user_id', '==', uid).get();
  for (const m of members.docs) {
    const dinnerId = m.data().dinnerId;
    const d = dinnerId ? await db.collection('dinners').doc(dinnerId).get() : null;
    const date = d && d.exists && d.data().date.toDate ? d.data().date.toDate().toISOString().split('T')[0] : null;
    if (date && date < todayKey) continue; // already happened — keep the history
    await m.ref.delete(); tables += 1;
  }
  const bs = await db.collection('bookings').where('userId', '==', uid).get();
  for (const b of bs.docs) {
    const key = b.data().tuesdayDate;
    if (key && key < todayKey) continue;
    await b.ref.delete(); bookings += 1;
  }
  return { tables, bookings };
}

// The decision: ban / warn / let it go.
router.post('/:id/resolve', adminAuth, async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!['ban', 'warn', 'dismiss'].includes(action)) return res.status(400).json({ error: 'Choose ban, warn or let go.' });
    const ref = db.collection('safetyReports').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Report not found' });
    const r = snap.data();

    let removed = null;
    if (action === 'ban') {
      const uid = r.reportedUserId;
      await db.collection('users').doc(uid).set({
        banned: true, bannedAt: admin.firestore.FieldValue.serverTimestamp(), bannedReason: r.reason || null, bannedReportId: snap.id,
      }, { merge: true });
      banned.add(uid);
      try { await auth.updateUser(uid, { disabled: true }); await auth.revokeRefreshTokens(uid); }
      catch (e) { console.error('Could not disable auth user', uid, e.message); }
      const subs = await db.collection('pushSubscriptions').where('userId', '==', uid).get();
      await Promise.all(subs.docs.map((d) => d.ref.delete()));
      removed = await removeFromUpcoming(uid);
    }

    await ref.set({
      status: 'resolved',
      outcome: action === 'ban' ? 'banned' : action === 'warn' ? 'warned' : 'let_go',
      resolutionNote: typeof note === 'string' ? note.slice(0, 2000) : '',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedBy: req.admin.id,
    }, { merge: true });

    res.json({ success: true, removed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Changed your mind — reopen a report.
router.post('/:id/reopen', adminAuth, async (req, res) => {
  try {
    const ref = db.collection('safetyReports').doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Report not found' });
    await ref.set({ status: 'open', outcome: null, resolvedAt: null }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users/:userId/unban', adminAuth, async (req, res) => {
  try {
    const uid = req.params.userId;
    await db.collection('users').doc(uid).set({ banned: false, bannedAt: null }, { merge: true });
    banned.remove(uid);
    try { await auth.updateUser(uid, { disabled: false }); } catch (e) { console.error('Could not re-enable auth user', uid, e.message); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
