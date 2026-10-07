const { db } = require('../firebase');

// Accounts the team has banned. Firebase's own "disabled" flag only bites when
// a token is next refreshed (up to an hour), so the API also checks this set
// on every request and cuts a banned person off immediately. Held in memory
// (one API instance) and refilled from Firestore on start.
const banned = new Set();

async function load() {
  try {
    const snap = await db.collection('users').where('banned', '==', true).get();
    snap.docs.forEach((d) => banned.add(d.id));
  } catch (e) {
    console.error('Could not load banned users', e.message);
  }
}

module.exports = {
  load,
  has: (uid) => banned.has(uid),
  add: (uid) => banned.add(uid),
  remove: (uid) => banned.delete(uid),
};
