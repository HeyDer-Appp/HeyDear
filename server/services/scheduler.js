const { db } = require('../firebase');
const { nzTime } = require('../utils/nzTime');
const pushService = require('./push');

// Mirrors portal.js's glimpseRevealAt/venueRevealAt (48h / 24h before the
// 7pm dinner) — kept in sync manually since these live in separate route
// files, same pattern group.js already uses for its own copy.
function glimpseRevealAt(dinnerDate) {
  return new Date(nzTime(dinnerDate, 19, 0).getTime() - 48 * 60 * 60 * 1000);
}
function venueRevealAt(dinnerDate) {
  return new Date(glimpseRevealAt(dinnerDate).getTime() + 24 * 60 * 60 * 1000);
}
// 6:30pm the night of — 30 minutes before the 7pm sit-down.
function rsvpPromptAt(dinnerDate) {
  return nzTime(dinnerDate, 18, 30);
}

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Confirmed tables only get pushed once per reveal stage — pushGlimpseSent/
// pushVenueSent on the table doc are the guard, checked and set in the same
// pass so a table already fully revealed is skipped without extra reads.
async function checkReveals() {
  const now = new Date();
  const tablesSnap = await db.collection('tables').where('status', '==', 'confirmed').get();

  for (const doc of tablesSnap.docs) {
    const table = doc.data();
    if (table.pushGlimpseSent && table.pushVenueSent && table.pushRsvpSent) continue;

    const dinnerSnap = await db.collection('dinners').doc(table.dinnerId).get();
    if (!dinnerSnap.exists) continue;
    const dinnerDate = dinnerSnap.data().date.toDate();
    if (dinnerDate < now) continue;

    if (!table.pushGlimpseSent && now >= glimpseRevealAt(dinnerDate)) {
      const formattedDate = dinnerDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Pacific/Auckland' });
      await pushService.sendToTable(doc.id, pushService.notifications.glimpse(formattedDate)).catch(() => {});
      await doc.ref.set({ pushGlimpseSent: true }, { merge: true });
    }

    if (!table.pushVenueSent && now >= venueRevealAt(dinnerDate)) {
      let restaurantName = 'your venue';
      if (table.restaurantId) {
        const restSnap = await db.collection('restaurants').doc(table.restaurantId).get();
        if (restSnap.exists && restSnap.data().name) restaurantName = restSnap.data().name;
      }
      await pushService.sendToTable(doc.id, pushService.notifications.venueReveal(restaurantName)).catch(() => {});
      await doc.ref.set({ pushVenueSent: true }, { merge: true });
    }

    if (!table.pushRsvpSent && now >= rsvpPromptAt(dinnerDate)) {
      await pushService.sendToTable(doc.id, pushService.notifications.rsvpPrompt()).catch(() => {});
      await doc.ref.set({ pushRsvpSent: true }, { merge: true });
    }
  }
}

function start() {
  checkReveals().catch((err) => console.error('scheduler: initial checkReveals failed', err));
  setInterval(() => {
    checkReveals().catch((err) => console.error('scheduler: checkReveals failed', err));
  }, CHECK_INTERVAL_MS);
}

module.exports = { start, checkReveals };
