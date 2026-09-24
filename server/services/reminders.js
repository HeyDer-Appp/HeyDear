// Automatic reminders, each with its own audience, timing and wording that the
// admin can edit (Notify → Reminders). The defaults below are what runs until
// an admin changes something; changes are stored per rule in `reminderRules`.
//
// Timing is "N days before the Tuesday dinner at HH:MM Auckland time"
// (negative N = after the dinner). Each rule fires once per dinner.

const { admin, db } = require('../firebase');
const { nzTime } = require('../utils/nzTime');
const pushService = require('./push');

const DAY = 24 * 60 * 60 * 1000;

const DEFAULT_RULES = [
  {
    id: 'not_booked', label: 'Not booked yet',
    who: 'People with a finished profile who haven’t booked any upcoming dinner',
    audience: 'not_booked', daysBefore: 5, time: '18:00',
    title: 'Tuesday’s table is waiting 🍽️',
    body: 'Pick your spot for this week’s HeyDer dinner — groups fill up fast.',
    url: '/portal/book', enabled: true,
  },
  {
    id: 'last_call', label: 'Last call to book',
    who: 'Same people as above, closer to the booking cut-off',
    audience: 'not_booked', daysBefore: 2, time: '12:00',
    title: 'Last call for Tuesday ⏰',
    body: 'Booking closes today at 6pm. Grab your seat before it’s gone.',
    url: '/portal/book', enabled: true,
  },
  {
    id: 'booked_waiting', label: 'Booked — group not found yet',
    who: 'People who booked this dinner but haven’t been placed in a group yet',
    audience: 'booked_waiting', daysBefore: 5, time: '10:00',
    title: 'Just 3 more days 👀',
    body: 'We’re still finding your group for Tuesday’s dinner — hang tight, you’ll hear from us soon.',
    url: '/portal', enabled: true,
  },
  {
    id: 'glimpse', label: 'Meet your table (glimpse)',
    who: 'Everyone in a confirmed group',
    audience: 'table', daysBefore: 2, time: '19:00',
    title: 'A glimpse of your table 👀',
    body: 'Dinner is in 48 hours. Tap to see who you’re meeting.',
    url: '/portal', enabled: true, legacyFlag: 'pushGlimpseSent',
  },
  {
    id: 'venue', label: 'Venue reveal',
    who: 'Everyone in a confirmed group',
    audience: 'table', daysBefore: 1, time: '19:00',
    title: 'Tonight’s venue is revealed 📍',
    body: 'Head to {restaurant} at 7pm. Tap for full details.',
    url: '/portal', enabled: true, legacyFlag: 'pushVenueSent',
  },
  {
    id: 'rsvp', label: 'Still coming? (confirmation)',
    who: 'Everyone in a confirmed group, on the night',
    audience: 'table', daysBefore: 0, time: '18:30',
    title: 'Still coming tonight? 🍽️',
    body: 'Dinner starts at 7pm — open the app to confirm.',
    url: '/portal', enabled: true, legacyFlag: 'pushRsvpSent',
  },
  {
    id: 'feedback', label: 'How was it? (feedback)',
    who: 'Everyone who was at a group, the day after',
    audience: 'table', daysBefore: -1, time: '12:00',
    title: 'How was last night? 💬',
    body: 'Two minutes to share your feedback — it shapes every dinner.',
    url: '/portal', enabled: true,
  },
];

const RULE_IDS = new Set(DEFAULT_RULES.map((r) => r.id));

async function getRules() {
  const snap = await db.collection('reminderRules').get();
  const overrides = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
  return DEFAULT_RULES.map((r) => {
    const o = overrides[r.id] || {};
    return {
      ...r,
      enabled: typeof o.enabled === 'boolean' ? o.enabled : r.enabled,
      daysBefore: Number.isInteger(o.daysBefore) ? o.daysBefore : r.daysBefore,
      time: /^\d{2}:\d{2}$/.test(o.time || '') ? o.time : r.time,
      title: o.title || r.title,
      body: o.body || r.body,
      customised: !!snap.docs.find((d) => d.id === r.id),
    };
  });
}

function sendTimeFor(rule, dinnerDate) {
  const [hh, mm] = rule.time.split(':').map(Number);
  return nzTime(new Date(dinnerDate.getTime() - rule.daysBefore * DAY), hh, mm);
}

function fill(text, ctx) {
  return String(text || '')
    .replace(/\{restaurant\}/g, ctx.restaurant || 'your venue')
    .replace(/\{afterparty\}/g, ctx.afterparty || 'the after-party')
    .replace(/\{area\}/g, ctx.area || '')
    .replace(/\{name\}/g, ctx.name || 'your group')
    .replace(/\{date\}/g, ctx.date || 'Tuesday');
}

function todayKeyNz() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }); }

async function upcomingBookedUserIds() {
  const snap = await db.collection('bookings').where('tuesdayDate', '>=', todayKeyNz()).get();
  return new Set(snap.docs.filter((d) => d.data().paid !== false && d.data().userId).map((d) => d.data().userId));
}

async function sendToUsers(userIds, payloadFor) {
  let sent = 0;
  for (const uid of userIds) {
    try { sent += await pushService.sendToUser(uid, payloadFor(uid)); } catch { /* one bad device shouldn't stop the rest */ }
  }
  return sent;
}

const LATE_WINDOW = 6 * 60 * 60 * 1000;

async function runReminders(now = new Date()) {
  const rules = (await getRules()).filter((r) => r.enabled);
  if (!rules.length) return;

  const from = new Date(now.getTime() - 4 * DAY);
  const to = new Date(now.getTime() + 8 * DAY);
  const dinnersSnap = await db.collection('dinners').where('date', '>=', from).where('date', '<=', to).get();

  for (const dinnerDoc of dinnersSnap.docs) {
    const dinner = dinnerDoc.data();
    const dinnerDate = dinner.date.toDate();
    const dateKey = dinnerDate.toISOString().split('T')[0];
    const dinnerStart = nzTime(dinnerDate, 19, 0);
    const sentMap = dinner.remindersSent || {};
    const dateLabel = dinnerDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

    for (const rule of rules) {
      const at = sendTimeFor(rule, dinnerDate);
      if (now < at) continue;

      // ── Per-table rules: catch up for tables confirmed after the moment passed
      if (rule.audience === 'table') {
        const after = rule.daysBefore < 0;
        if (!after && now >= dinnerStart) continue;
        if (after && now.getTime() > at.getTime() + 2 * DAY) continue;
        const tablesSnap = await db.collection('tables').where('dinnerId', '==', dinnerDoc.id).where('status', '==', 'confirmed').get();
        for (const t of tablesSnap.docs) {
          const table = t.data();
          if ((table.remindersSent || {})[rule.id] || (rule.legacyFlag && table[rule.legacyFlag])) continue;
          let restaurant = null;
          if (table.restaurantId) restaurant = (await db.collection('restaurants').doc(table.restaurantId).get()).data();
          const ctx = { restaurant: restaurant?.name, afterparty: dinner.afterparty?.name, area: dinner.area, name: table.name, date: dateLabel };
          const payload = { ...pushService.notifications.custom(fill(rule.title, ctx), fill(rule.body, ctx), rule.url), tag: `reminder-${rule.id}`, requireInteraction: false };
          // Claim before sending so an overlapping tick can't double-send.
          await t.ref.set({ remindersSent: { ...(table.remindersSent || {}), [rule.id]: admin.firestore.Timestamp.now() }, ...(rule.legacyFlag ? { [rule.legacyFlag]: true } : {}) }, { merge: true });
          if (rule.id === 'feedback') {
            const members = await db.collection('tableMembers').where('tableId', '==', t.id).get();
            await sendToUsers(members.docs.map((m) => m.data().user_id).filter(Boolean), (uid) => ({ ...payload, url: `/feedback/${dinnerDoc.id}?uid=${uid}` }));
          } else {
            await pushService.sendToTable(t.id, payload).catch(() => {});
          }
        }
        continue;
      }

      // ── Audience rules: once per dinner, and never a late blast
      if (sentMap[rule.id]) continue;
      if (now.getTime() > at.getTime() + LATE_WINDOW) continue;
      if (now >= dinnerStart) continue;

      const ctx = { afterparty: dinner.afterparty?.name, area: dinner.area, date: dateLabel };
      const payload = { ...pushService.notifications.custom(fill(rule.title, ctx), fill(rule.body, ctx), rule.url), tag: `reminder-${rule.id}` };
      await dinnerDoc.ref.set({ remindersSent: { ...sentMap, [rule.id]: admin.firestore.Timestamp.now() } }, { merge: true });
      sentMap[rule.id] = true;

      if (rule.audience === 'booked_waiting') {
        const bookings = await db.collection('bookings').where('tuesdayDate', '==', dateKey).where('matched', '==', false).get();
        for (const b of bookings.docs) {
          const bd = b.data();
          if (bd.paid === false || bd.pushFindGroupReminderSent || !bd.userId) continue;
          await pushService.sendToUser(bd.userId, payload).catch(() => {});
          await b.ref.set({ pushFindGroupReminderSent: true }, { merge: true });
        }
      } else if (rule.audience === 'not_booked') {
        const [users, booked] = await Promise.all([db.collection('users').where('profileComplete', '==', true).get(), upcomingBookedUserIds()]);
        await sendToUsers(users.docs.map((u) => u.id).filter((id) => !booked.has(id)), () => payload);
      }
    }
  }
}

// What each rule will do next, for the admin screen.
async function nextSchedule() {
  const rules = await getRules();
  const now = new Date();
  const snap = await db.collection('dinners').where('date', '>=', new Date(now.getTime() - DAY)).get();
  const next = snap.docs.map((d) => ({ id: d.id, date: d.data().date.toDate() })).sort((a, b) => a.date - b.date)[0];
  return { dinner: next ? { id: next.id, date: next.date.toISOString() } : null, rules: rules.map((r) => ({ ...r, nextAt: next ? sendTimeFor(r, next.date).toISOString() : null })) };
}

module.exports = { DEFAULT_RULES, RULE_IDS, getRules, runReminders, nextSchedule, sendTimeFor };
