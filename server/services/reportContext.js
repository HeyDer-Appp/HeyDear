const { db } = require('../firebase');

// The dinner table two people shared — what a report is "about" when it
// happened at (or because of) a dinner. When they've sat together more than
// once, the most recent table at or before `before` wins.
async function sharedTable(userA, userB, before = new Date()) {
  if (!userA || !userB) return null;
  const [a, b] = await Promise.all([
    db.collection('tableMembers').where('user_id', '==', userA).get(),
    db.collection('tableMembers').where('user_id', '==', userB).get(),
  ]);
  const bTables = new Set(b.docs.map((d) => d.data().tableId));
  const common = a.docs.map((d) => d.data()).filter((m) => bTables.has(m.tableId));
  if (!common.length) return null;

  const rows = [];
  for (const m of common) {
    const t = await db.collection('tables').doc(m.tableId).get();
    if (!t.exists) continue;
    const dinnerId = t.data().dinnerId || m.dinnerId;
    const d = dinnerId ? await db.collection('dinners').doc(dinnerId).get() : null;
    const date = d && d.exists && d.data().date && d.data().date.toDate ? d.data().date.toDate() : null;
    rows.push({ tableId: t.id, dinnerId, date, table: t.data() });
  }
  if (!rows.length) return null;
  rows.sort((x, y) => (y.date || 0) - (x.date || 0));
  // Dinners are at 7pm — treat the whole report day as "after" the dinner date.
  const cutoff = new Date(before.getTime() + 24 * 3600 * 1000);
  return rows.find((r) => !r.date || r.date <= cutoff) || rows[rows.length - 1];
}

module.exports = { sharedTable };
