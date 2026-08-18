const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const pushService = require('../services/push');
const { nzTime } = require('../utils/nzTime');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// A connection's doc id is always the two user ids sorted and joined — that
// makes "do these two already have a connection" a direct doc read instead
// of a query, and makes the relationship inherently symmetric.
function pairId(a, b) { return [a, b].sort().join('_'); }

// Same 8pm-dinner-night threshold group.js uses for the group chat's names/
// photos reveal — connecting with someone makes no sense before you can
// even see who they are.
function revealAt(dinnerDate) { return nzTime(dinnerDate, 20, 0); }

async function confirmedRevealedTable(tableId) {
  const tableSnap = await db.collection('tables').doc(tableId).get();
  const table = tableSnap.data();
  if (!table || table.status !== 'confirmed') return null;
  const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
  const dinnerDate = toDate(dinnerSnap.data()?.date);
  if (!dinnerDate || new Date() < revealAt(dinnerDate)) return null;
  return table;
}

// The gate for both "view this person's profile" and "send them a connect
// request": you have to have actually sat at a table with them, and that
// dinner's reveal has to have already happened — mirrors the group chat's
// own privacy model instead of introducing a new one.
async function sharedRevealedTableId(uidA, uidB) {
  const snapA = await db.collection('tableMembers').where('user_id', '==', uidA).get();
  const tableIdsA = [...new Set(snapA.docs.map(d => d.data().tableId))];
  if (!tableIdsA.length) return null;

  for (let i = 0; i < tableIdsA.length; i += 30) {
    const chunk = tableIdsA.slice(i, i + 30);
    const snapB = await db.collection('tableMembers')
      .where('user_id', '==', uidB)
      .where('tableId', 'in', chunk)
      .get();
    for (const doc of snapB.docs) {
      const tableId = doc.data().tableId;
      if (await confirmedRevealedTable(tableId)) return tableId;
    }
  }
  return null;
}

function isExpired(reqData) {
  return reqData.status === 'pending' && Date.now() - (reqData.createdAt?.toMillis?.() || 0) > SEVEN_DAYS_MS;
}

async function userSummary(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const u = snap.data() || {};
  return { user_id: uid, first_name: u.firstName || null, photo: u.photo || null, country: u.country || null };
}

// Every dinner-confirmed table this user has actually sat at, past its
// reveal — "dinners attended", not just "dinners booked".
async function attendedTableCount(uid) {
  const snap = await db.collection('tableMembers').where('user_id', '==', uid).get();
  const tableIds = [...new Set(snap.docs.map(d => d.data().tableId))];
  const results = await Promise.all(tableIds.map(id => confirmedRevealedTable(id)));
  return results.filter(Boolean).length;
}

async function connectionCount(uid) {
  const [asA, asB] = await Promise.all([
    db.collection('connections').where('user1Id', '==', uid).get(),
    db.collection('connections').where('user2Id', '==', uid).get(),
  ]);
  return asA.size + asB.size;
}

// List my accepted connections plus any pending requests (incoming and
// outgoing) that haven't expired — expired ones are simply left out here
// rather than written back to Firestore, same lazy-computation pattern
// used everywhere else in this codebase for time-based state.
router.get('/', attendeeAuth, async (req, res) => {
  try {
    const uid = req.user.id;

    const [asA, asB, incomingSnap, outgoingSnap] = await Promise.all([
      db.collection('connections').where('user1Id', '==', uid).get(),
      db.collection('connections').where('user2Id', '==', uid).get(),
      db.collection('connectionRequests').where('toUserId', '==', uid).where('status', '==', 'pending').get(),
      db.collection('connectionRequests').where('fromUserId', '==', uid).where('status', '==', 'pending').get(),
    ]);

    const connectionDocs = [...asA.docs, ...asB.docs];
    const connections = await Promise.all(connectionDocs.map(async (d) => {
      const c = d.data();
      const otherId = c.user1Id === uid ? c.user2Id : c.user1Id;
      return { connection_id: d.id, ...(await userSummary(otherId)), created_at: toDate(c.createdAt)?.toISOString() || null };
    }));
    connections.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const incoming = await Promise.all(
      incomingSnap.docs.filter(d => !isExpired(d.data())).map(async (d) => {
        const r = d.data();
        return { request_id: d.id, ...(await userSummary(r.fromUserId)), created_at: toDate(r.createdAt)?.toISOString() || null };
      })
    );
    const outgoing = await Promise.all(
      outgoingSnap.docs.filter(d => !isExpired(d.data())).map(async (d) => {
        const r = d.data();
        return { request_id: d.id, ...(await userSummary(r.toUserId)), created_at: toDate(r.createdAt)?.toISOString() || null };
      })
    );

    res.json({ connections, incoming_requests: incoming, outgoing_requests: outgoing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// A person's profile — only viewable once you've actually shared a
// revealed table with them, or you're already connected. Their connection
// count and dinners-attended count are always shown to a viewer who's
// cleared that gate; their photos are every photo they've ever uploaded
// across any of their dinners, not just the one you shared with them —
// this is meant to read as their personal album, not a per-table gallery.
router.get('/profile/:userId', attendeeAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    if (userId === viewerId) return res.status(400).json({ error: 'That\'s you.' });

    const pairSnap = await db.collection('connections').doc(pairId(viewerId, userId)).get();
    const connected = pairSnap.exists;

    if (!connected) {
      const shared = await sharedRevealedTableId(viewerId, userId);
      if (!shared) return res.status(403).json({ error: "You haven't shared a revealed dinner with this person yet." });
    }

    const [summary, dinners, connCount, photosSnap] = await Promise.all([
      userSummary(userId),
      attendedTableCount(userId),
      connectionCount(userId),
      db.collection('dinnerPhotos').where('userId', '==', userId).get(),
    ]);

    const photos = photosSnap.docs
      .map(d => ({ id: d.id, photo: d.data().photo, createdAt: toDate(d.data().createdAt)?.toISOString() || null }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    let connectionStatus = 'none';
    let connectionId = null;
    let requestId = null;
    if (connected) {
      connectionStatus = 'connected';
      connectionId = pairSnap.id;
    } else {
      const [outSnap, inSnap] = await Promise.all([
        db.collection('connectionRequests').where('fromUserId', '==', viewerId).where('toUserId', '==', userId).where('status', '==', 'pending').get(),
        db.collection('connectionRequests').where('fromUserId', '==', userId).where('toUserId', '==', viewerId).where('status', '==', 'pending').get(),
      ]);
      const outReq = outSnap.docs.find(d => !isExpired(d.data()));
      const inReq = inSnap.docs.find(d => !isExpired(d.data()));
      if (outReq) connectionStatus = 'pending_outgoing';
      else if (inReq) { connectionStatus = 'pending_incoming'; requestId = inReq.id; }
    }

    res.json({
      ...summary, dinners_attended: dinners, connections_count: connCount, photos,
      connection_status: connectionStatus, connection_id: connectionId, request_id: requestId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sending a request when the other person already sent you one just
// accepts theirs instead of creating a crossed duplicate — two people
// both wanting to connect shouldn't require them to each separately hit
// "accept" on the other's request.
router.post('/request', attendeeAuth, async (req, res) => {
  try {
    const { toUserId } = req.body;
    const fromUserId = req.user.id;
    if (!toUserId || toUserId === fromUserId) return res.status(400).json({ error: 'Invalid recipient' });

    const existingPair = await db.collection('connections').doc(pairId(fromUserId, toUserId)).get();
    if (existingPair.exists) return res.status(400).json({ error: 'Already connected' });

    const shared = await sharedRevealedTableId(fromUserId, toUserId);
    if (!shared) return res.status(403).json({ error: "You haven't shared a revealed dinner with this person yet." });

    const reverseSnap = await db.collection('connectionRequests')
      .where('fromUserId', '==', toUserId).where('toUserId', '==', fromUserId).where('status', '==', 'pending').get();
    const reverseReq = reverseSnap.docs.find(d => !isExpired(d.data()));
    if (reverseReq) {
      await db.collection('connections').doc(pairId(fromUserId, toUserId)).set({
        user1Id: fromUserId, user2Id: toUserId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await reverseReq.ref.set({ status: 'accepted', respondedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const me = await userSummary(fromUserId);
      pushService.sendToUser(toUserId, pushService.notifications.custom(
        'New connection 🎉', `${me.first_name || 'Someone'} connected with you.`, '/portal/chat'
      )).catch(() => {});
      return res.json({ success: true, status: 'connected' });
    }

    const outSnap = await db.collection('connectionRequests')
      .where('fromUserId', '==', fromUserId).where('toUserId', '==', toUserId).where('status', '==', 'pending').get();
    const existingOut = outSnap.docs.find(d => !isExpired(d.data()));
    if (existingOut) return res.json({ success: true, status: 'pending_outgoing' });

    const ref = await db.collection('connectionRequests').add({
      fromUserId, toUserId, tableId: shared, status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const me = await userSummary(fromUserId);
    pushService.sendToUser(toUserId, pushService.notifications.custom(
      'New connect request', `${me.first_name || 'Someone'} wants to connect.`, '/portal/chat'
    )).catch(() => {});

    res.json({ success: true, status: 'pending_outgoing', request_id: ref.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/requests/:requestId/accept', attendeeAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const ref = db.collection('connectionRequests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' });
    const r = snap.data();
    if (r.toUserId !== req.user.id) return res.status(403).json({ error: 'Not your request' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Already responded to' });
    if (isExpired(r)) return res.status(410).json({ error: 'This request has expired.' });

    await db.collection('connections').doc(pairId(r.fromUserId, r.toUserId)).set({
      user1Id: r.fromUserId, user2Id: r.toUserId, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await ref.set({ status: 'accepted', respondedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const me = await userSummary(req.user.id);
    pushService.sendToUser(r.fromUserId, pushService.notifications.custom(
      'Request accepted 🎉', `${me.first_name || 'Someone'} accepted your connect request.`, '/portal/chat'
    )).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/requests/:requestId/decline', attendeeAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const ref = db.collection('connectionRequests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Request not found' });
    const r = snap.data();
    if (r.toUserId !== req.user.id) return res.status(403).json({ error: 'Not your request' });
    if (r.status !== 'pending') return res.status(400).json({ error: 'Already responded to' });

    await ref.set({ status: 'declined', respondedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

async function requireConnection(connectionId, uid) {
  const snap = await db.collection('connections').doc(connectionId).get();
  if (!snap.exists) return null;
  const c = snap.data();
  if (c.user1Id !== uid && c.user2Id !== uid) return null;
  return c;
}

router.get('/:connectionId/messages', attendeeAuth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const c = await requireConnection(connectionId, req.user.id);
    if (!c) return res.status(404).json({ error: 'Connection not found' });

    const otherId = c.user1Id === req.user.id ? c.user2Id : c.user1Id;

    const [otherSummary, messagesSnap] = await Promise.all([
      userSummary(otherId),
      db.collection('dmMessages').where('connectionId', '==', connectionId).get(),
    ]);
    const messages = messagesSnap.docs
      .map(d => ({ id: d.id, from_user_id: d.data().fromUserId, text: d.data().text, created_at: toDate(d.data().createdAt)?.toISOString() || null, _sort: d.data().createdAt?.toMillis?.() || 0 }))
      .sort((a, b) => a._sort - b._sort)
      .map(({ _sort, ...m }) => m);

    res.json({ other: otherSummary, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:connectionId/messages', attendeeAuth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const c = await requireConnection(connectionId, req.user.id);
    if (!c) return res.status(404).json({ error: 'Connection not found' });
    const otherId = c.user1Id === req.user.id ? c.user2Id : c.user1Id;

    const docRef = await db.collection('dmMessages').add({
      connectionId, fromUserId: req.user.id, toUserId: otherId, text: text.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const me = await userSummary(req.user.id);
    pushService.sendToUser(otherId, pushService.notifications.custom(
      me.first_name || 'New message', text.trim().slice(0, 80), '/portal/chat'
    )).catch(() => {});

    res.json({ success: true, message: { id: docRef.id, from_user_id: req.user.id, text: text.trim(), created_at: new Date().toISOString() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
