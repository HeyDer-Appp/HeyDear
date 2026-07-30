const express = require('express');
const router = express.Router();
const { admin, db } = require('../firebase');
const { attendeeAuth } = require('../middleware/auth');
const { PROMPTS, getPrompt } = require('../data/prompts');

function toDate(v) {
  if (!v) return null;
  return typeof v.toDate === 'function' ? v.toDate() : new Date(v);
}

// The group chat is a two-stage build-up to dinner: a prompts-only stage
// that opens 48h before the 7pm sit-down, then a full reveal (real photos
// + free-text messaging) at 7:30pm the night of, once everyone's actually
// meant to be walking in the door.
function dinnerAt(dinnerDate, hours, minutes = 0) {
  const d = new Date(dinnerDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
function chatOpensAt(dinnerDate) {
  return new Date(dinnerAt(dinnerDate, 19, 0).getTime() - 48 * 60 * 60 * 1000);
}
function revealAt(dinnerDate) {
  return dinnerAt(dinnerDate, 19, 30);
}

// Finds the attendee's current relevant table: the soonest confirmed,
// matched table whose dinner hasn't finished yet. Mirrors the join used in
// album.js (bookings -> tables -> dinners) but narrowed to one active group
// rather than a full history.
async function findActiveTable(userId) {
  const bookingSnap = await db.collection('bookings')
    .where('userId', '==', userId)
    .where('matched', '==', true)
    .get();

  const tableIds = [...new Set(bookingSnap.docs.map(d => d.data().tableId).filter(Boolean))];
  const now = new Date();

  const candidates = await Promise.all(tableIds.map(async (tableId) => {
    const tableSnap = await db.collection('tables').doc(tableId).get();
    const table = tableSnap.data();
    if (!table || table.status !== 'confirmed') return null;

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    const dinner = dinnerSnap.data();
    const dinnerDate = toDate(dinner?.date);
    if (!dinnerDate) return null;

    // Stays active through the day after, same as the photo-album window
    // closing 7pm the next day — people keep chatting past the dinner itself.
    const cutoff = new Date(dinnerAt(dinnerDate, 19, 0).getTime() + 24 * 60 * 60 * 1000);
    if (cutoff < now) return null;

    return { tableId, table, dinnerId: table.dinnerId, dinnerDate };
  }));

  const valid = candidates.filter(Boolean).sort((a, b) => a.dinnerDate - b.dinnerDate);
  return valid[0] || null;
}

async function requireMembership(tableId, userId) {
  const memberSnap = await db.collection('tableMembers').doc(`${tableId}_${userId}`).get();
  if (!memberSnap.exists) return null;
  return memberSnap.data();
}

// The current attendee's active group chat: locked countdown before the
// 48h mark, prompts-and-answers feed once open, full reveal at 7:30pm.
router.get('/', attendeeAuth, async (req, res) => {
  try {
    const active = await findActiveTable(req.user.id);
    if (!active) return res.json({ has_group: false });

    const { tableId, dinnerDate } = active;
    const member = await requireMembership(tableId, req.user.id);
    if (!member) return res.json({ has_group: false });

    const opensAt = chatOpensAt(dinnerDate);
    const revealsAt = revealAt(dinnerDate);
    const now = new Date();
    const chatOpen = now >= opensAt;
    const revealed = now >= revealsAt;

    const base = {
      has_group: true,
      table_id: tableId,
      dinner_date: dinnerDate.toISOString(),
      chat_opens_at: opensAt.toISOString(),
      reveal_at: revealsAt.toISOString(),
      chat_open: chatOpen,
      revealed,
    };

    if (!chatOpen) return res.json(base);

    const [membersSnap, messagesSnap] = await Promise.all([
      db.collection('tableMembers').where('tableId', '==', tableId).get(),
      db.collection('groupMessages').where('tableId', '==', tableId).orderBy('createdAt', 'asc').get(),
    ]);

    const memberIds = membersSnap.docs.map(d => d.data().user_id).filter(Boolean);
    const userDocs = await Promise.all(memberIds.map(id => db.collection('users').doc(id).get()));
    const photoById = {};
    userDocs.forEach(snap => { if (snap.exists) photoById[snap.id] = snap.data().photo || null; });

    const members = memberIds.map(id => ({ user_id: id, photo: photoById[id] || null }));

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

    res.json({
      ...base,
      members,
      prompts: PROMPTS,
      messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Posts one of the fixed prompts into the group's chat — only during the
// prompts stage (48h-before window up to the 7:30pm reveal, though nothing
// stops it continuing after reveal too).
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

// Free-text messages — locked until 7:30pm on the dinner night, checked
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
      return res.status(403).json({ error: 'Messaging opens at 7:30pm on dinner night.' });
    }

    const docRef = await db.collection('groupMessages').add({
      tableId,
      dinnerId: table.dinnerId,
      type: 'text',
      userId: req.user.id,
      text: text.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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

module.exports = router;
