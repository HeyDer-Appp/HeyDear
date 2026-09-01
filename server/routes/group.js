const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { PROMPTS, getPrompt } = require('../data/prompts');
const { nzTime } = require('../utils/nzTime');
const pushService = require('../services/push');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// The group chat is a two-stage build-up to dinner: a prompts-only stage
// that opens 48h before the 7pm sit-down, then a full reveal (real photos,
// real names + free-text messaging) at 8pm the night of, once dinner is
// underway. There's no closing time —
// once revealed, a group stays fully open (clear photos, free texting)
// forever after, which is also what makes a past/attended dinner's chat
// naturally end up in the "revealed" state with zero special-casing.
function chatOpensAt(dinnerDate) {
  return new Date(nzTime(dinnerDate, 19, 0).getTime() - 48 * 60 * 60 * 1000);
}
function revealAt(dinnerDate) {
  return nzTime(dinnerDate, 20, 0);
}
function timingSummary(dinnerDate) {
  const opensAt = chatOpensAt(dinnerDate);
  const revealsAt = revealAt(dinnerDate);
  const now = new Date();
  return {
    // The 7pm-NZT dinner-start instant, not midnight UTC of the day — used
    // for both display and the sort/upcoming-vs-attended split below.
    dinner_date: nzTime(dinnerDate, 19, 0).toISOString(),
    chat_opens_at: opensAt.toISOString(),
    reveal_at: revealsAt.toISOString(),
    chat_open: now >= opensAt,
    revealed: now >= revealsAt,
  };
}

// A member who has exited a group is treated as if they were never a
// member for every route below — exiting only removes the group from
// their own list/access, it doesn't touch the table for anyone else.
async function requireMembership(tableId, userId) {
  const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${userId}`).get();
  if (!memberSnap.exists) return null;
  const member = memberSnap.data();
  if (member.hiddenFromGroupList) return null;
  return member;
}

// Mirrors connectionHasUnread's pattern in connections.js — a message from
// anyone other than this user, newer than their own lastReadAt on this
// table, counts as unread.
async function groupHasUnread(tableId, uid, lastReadAt) {
  const lastReadMs = lastReadAt?.toMillis?.() || 0;
  const snap = await db.collection('groupMessages').where('tableId', '==', tableId).get();
  return snap.docs.some(d => {
    const m = d.data();
    return m.userId !== uid && (m.createdAt?.toMillis?.() || 0) > lastReadMs;
  });
}

// Every group chat this attendee has ever been matched into (not hidden),
// newest dinner first — mirrors the bookings -> tables -> dinners join used
// in album.js, but lists everything rather than picking one active table.
router.get('/', attendeeAuth, async (req, res) => {
  try {
    const bookingSnap = await db.collection('bookings')
      .where('userId', '==', req.user.id)
      .where('matched', '==', true)
      .get();

    const tableIds = [...new Set(bookingSnap.docs.map(d => d.data().tableId).filter(Boolean))];

    const groups = await Promise.all(tableIds.map(async (tableId) => {
      const member = await requireMembership(tableId, req.user.id);
      if (!member) return null;

      const tableSnap = await db.collection('tables').doc(tableId).get();
      const table = tableSnap.data();
      if (!table || table.status !== 'confirmed') return null;

      const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
      const dinner = dinnerSnap.data();
      const dinnerDate = toDate(dinner?.date);
      if (!dinnerDate) return null;

      const timing = timingSummary(dinnerDate);
      const [membersSnap, hasUnread] = await Promise.all([
        db.collection('tableMembers').where('tableId', '==', tableId).get(),
        timing.chat_open ? groupHasUnread(tableId, req.user.id, member.lastReadAt) : Promise.resolve(false),
      ]);

      return {
        table_id: tableId,
        city: dinner.city || 'Auckland',
        member_count: membersSnap.size,
        has_unread: hasUnread,
        ...timing,
      };
    }));

    const clean = groups.filter(Boolean).sort((a, b) => new Date(b.dinner_date) - new Date(a.dinner_date));
    res.json({ groups: clean });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// One group chat's full detail: locked countdown before the 48h mark,
// prompts-and-answers feed once open, full reveal (real photos, real names
// + free text) at 8pm — which for any dinner that's already happened is
// always true.
router.get('/:tableId', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const member = await requireMembership(tableId, req.user.id);
    if (!member) return res.status(404).json({ error: 'Group not found' });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinner = dinnerSnap.data();
    const dinnerDate = toDate(dinner?.date);
    if (!dinnerDate) return res.status(404).json({ error: 'Dinner not found' });

    const timing = timingSummary(dinnerDate);
    const base = { table_id: tableId, city: dinner.city || 'Auckland', ...timing };

    if (!timing.chat_open) return res.json(base);

    // Opening the chat is what clears its unread state for the list's
    // green dot — fire-and-forget since it shouldn't hold up the response.
    db.collection('tableMembers').doc(`${tableId}_${req.user.id}`)
      .set({ lastReadAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => {});

    // where() + orderBy() on different fields needs a composite index, so
    // filter here and sort in memory instead (same pattern used everywhere
    // else in this codebase).
    const [membersSnap, messagesSnap] = await Promise.all([
      db.collection('tableMembers').where('tableId', '==', tableId).get(),
      db.collection('groupMessages').where('tableId', '==', tableId).get(),
    ]);
    messagesSnap.docs.sort((a, b) => (a.data().createdAt?.toMillis?.() || 0) - (b.data().createdAt?.toMillis?.() || 0));

    const memberIds = membersSnap.docs.map(d => d.data().user_id).filter(Boolean);
    const userDocs = await Promise.all(memberIds.map(id => db.collection('users').doc(id).get()));
    const infoById = {};
    userDocs.forEach(snap => { if (snap.exists) infoById[snap.id] = snap.data(); });

    // Names ship alongside photos the same way — the client is what blurs/
    // masks both until the 8pm reveal, not a server-side gate, since the
    // messages feed already relies on the same client-side reveal flag.
    const members = memberIds.map(id => ({
      user_id: id,
      photo: infoById[id]?.photo || null,
      first_name: infoById[id]?.firstName || null,
      country: infoById[id]?.country || null,
    }));

    const messages = messagesSnap.docs.map(d => {
      const m = d.data();
      return {
        id: d.id,
        type: m.type,
        user_id: m.userId,
        prompt_id: m.promptId || null,
        prompt_text: m.promptText || null,
        prompt_options: m.promptOptions || null,
        reply_to_id: m.replyToId || null,
        option: m.option || null,
        text: m.text || null,
        created_at: toDate(m.createdAt)?.toISOString() || null,
      };
    });

    res.json({ ...base, members, prompts: PROMPTS, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Posts one of the fixed prompts into the group's chat — only during the
// prompts stage (48h-before window onward).
router.post('/:tableId/prompts', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { promptId } = req.body;

    const prompt = getPrompt(promptId);
    if (!prompt) return res.status(400).json({ error: 'Unknown prompt' });

    const member = await requireMembership(tableId, req.user.id);
    if (!member) return res.status(403).json({ error: "You weren't seated at this table" });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);

    if (!dinnerDate || new Date() < chatOpensAt(dinnerDate)) {
      return res.status(403).json({ error: 'Group chat opens 48 hours before dinner.' });
    }

    const docRef = await db.collection('groupMessages').add({
      tableId,
      dinnerId: table.dinnerId,
      type: 'prompt',
      userId: req.user.id,
      promptId: prompt.id,
      promptText: prompt.text,
      promptOptions: prompt.options,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: {
        id: docRef.id,
        type: 'prompt',
        user_id: req.user.id,
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        prompt_options: prompt.options,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Answers a posted prompt by picking one of its fixed options — the option
// is validated against the original prompt's option list server-side so
// this can never be used to smuggle in free text before the reveal.
router.post('/:tableId/messages/:messageId/answer', attendeeAuth, async (req, res) => {
  try {
    const { tableId, messageId } = req.params;
    const { option } = req.body;

    const member = await requireMembership(tableId, req.user.id);
    if (!member) return res.status(403).json({ error: "You weren't seated at this table" });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);

    if (!dinnerDate || new Date() < chatOpensAt(dinnerDate)) {
      return res.status(403).json({ error: 'Group chat opens 48 hours before dinner.' });
    }

    const promptSnap = await db.collection('groupMessages').doc(messageId).get();
    const promptMsg = promptSnap.data();
    if (!promptMsg || promptMsg.tableId !== tableId || promptMsg.type !== 'prompt') {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    if (!Array.isArray(promptMsg.promptOptions) || !promptMsg.promptOptions.includes(option)) {
      return res.status(400).json({ error: 'Invalid option for this prompt' });
    }
    if (promptMsg.userId === req.user.id) {
      return res.status(403).json({ error: "You can't answer your own question." });
    }

    const existingAnswerSnap = await db.collection('groupMessages')
      .where('tableId', '==', tableId)
      .where('replyToId', '==', messageId)
      .where('userId', '==', req.user.id)
      .get();
    if (!existingAnswerSnap.empty) {
      return res.status(400).json({ error: "You've already answered this question." });
    }

    const docRef = await db.collection('groupMessages').add({
      tableId,
      dinnerId: table.dinnerId,
      type: 'answer',
      userId: req.user.id,
      replyToId: messageId,
      promptText: promptMsg.promptText,
      option,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: {
        id: docRef.id,
        type: 'answer',
        user_id: req.user.id,
        reply_to_id: messageId,
        prompt_text: promptMsg.promptText,
        option,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Free-text messages — locked until 8pm on the dinner night, checked
// server-side so the client-side composer lock can't just be bypassed.
router.post('/:tableId/messages', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { text } = req.body;

    if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const member = await requireMembership(tableId, req.user.id);
    if (!member) return res.status(403).json({ error: "You weren't seated at this table" });

    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table) return res.status(404).json({ error: 'Table not found' });
    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinnerDate = toDate(dinnerSnap.data()?.date);

    if (!dinnerDate || new Date() < revealAt(dinnerDate)) {
      return res.status(403).json({ error: 'Messaging opens at 8pm on dinner night.' });
    }

    const docRef = await db.collection('groupMessages').add({
      tableId,
      dinnerId: table.dinnerId,
      type: 'text',
      userId: req.user.id,
      text: text.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    pushService.sendToTable(
      tableId,
      pushService.notifications.custom(member.firstName || 'New message', text.trim().slice(0, 80), '/portal/group-chat'),
      { excludeUserId: req.user.id }
    ).catch(() => {});

    res.json({
      success: true,
      message: {
        id: docRef.id,
        type: 'text',
        user_id: req.user.id,
        text: text.trim(),
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Removes this group from the caller's own list — a personal archive, not
// a real departure. Everyone else at the table keeps seeing them as a
// member and keeps seeing their past messages.
router.post('/:tableId/exit', attendeeAuth, async (req, res) => {
  try {
    const { tableId } = req.params;
    const memberRef = db.collection('tableMembers').doc(`${tableId}_${req.user.id}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return res.status(403).json({ error: "You weren't seated at this table" });

    await memberRef.set({ hiddenFromGroupList: true }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
