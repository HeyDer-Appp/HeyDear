const express = require('express');
const router = express.Router();
const { db } = require('../../firebase');
const { adminAuth } = require('../../middleware/auth');

function getAgeGroup(dob) {
  if (!dob) return null;
  const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 25) return '18-24';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 40) return '35-39';
  if (age < 50) return '40-49';
  return '50+';
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { city } = req.query;
    const [usersSnap, bookingsSnap, feedbackSnap, confirmedMembersSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('bookings').get(),
      db.collection('feedback').get(),
      db.collection('tableMembers').where('confirmed', '==', true).get(),
    ]);

    let users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (city) users = users.filter(u => (u.city || 'Auckland') === city);
    // Bookings/feedback/tableMembers don't carry their own city — joined
    // back to the signup's city via userId so a city filter applies
    // consistently everywhere, not just the raw signup count.
    const cityUserIds = city ? new Set(users.map(u => u.id)) : null;

    let bookings = bookingsSnap.docs.map(d => d.data());
    if (cityUserIds) bookings = bookings.filter(b => cityUserIds.has(b.userId));
    let feedback = feedbackSnap.docs.map(d => d.data());
    if (cityUserIds) feedback = feedback.filter(f => cityUserIds.has(f.userId));

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const createdMs = (u) => u.createdAt?.toMillis?.() || 0;

    const genderCounts = countBy(users, u => u.gender);
    const genderSplit = Object.entries(genderCounts)
      .map(([gender, count]) => ({ gender, count }))
      .sort((a, b) => b.count - a.count);

    const intentCounts = countBy(bookings, b => b.field_cqCcs6psQuhE);
    const intentSplit = Object.entries(intentCounts).map(([intent, count]) => ({ intent, count }));

    const budgetCounts = countBy(bookings, b => b.field_Ar4xQbXT6CLh);
    const budgetSplit = Object.entries(budgetCounts).map(([budget, count]) => ({ budget, count }));

    const ageGroups = {};
    for (const u of users) {
      const group = getAgeGroup(u.dob);
      if (group) ageGroups[group] = (ageGroups[group] || 0) + 1;
    }
    const ageDistribution = Object.entries(ageGroups)
      .map(([age_group, count]) => ({ age_group, count }))
      .sort((a, b) => a.age_group.localeCompare(b.age_group));

    const dateCounts = countBy(bookings, b => b.tuesdayDate);
    const topDates = Object.entries(dateCounts)
      .map(([tuesday_date, signups]) => ({ tuesday_date, signups }))
      .sort((a, b) => b.signups - a.signups)
      .slice(0, 10);

    const countryCounts = countBy(users, u => u.country);
    const countryBreakdown = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const withNps = feedback.filter(f => f.nps != null);
    const avgNps = withNps.length ? withNps.reduce((s, f) => s + f.nps, 0) / withNps.length : 0;
    const withRating = feedback.filter(f => f.overall_rating != null);
    const avgRating = withRating.length ? withRating.reduce((s, f) => s + f.overall_rating, 0) / withRating.length : 0;

    // Retention — distinct dinners per user among confirmed table members
    let confirmedMembers = confirmedMembersSnap.docs.map(d => d.data());
    if (cityUserIds) confirmedMembers = confirmedMembers.filter(m => cityUserIds.has(m.user_id));
    const dinnersByUser = {};
    for (const m of confirmedMembers) {
      if (!dinnersByUser[m.user_id]) dinnersByUser[m.user_id] = new Set();
      dinnersByUser[m.user_id].add(m.dinnerId);
    }
    const totalAttendees = Object.keys(dinnersByUser).length;
    const returned = Object.values(dinnersByUser).filter(s => s.size > 1).length;
    const retentionRate = totalAttendees > 0 ? Math.round((returned / totalAttendees) * 100) : 0;

    res.json({
      totals: {
        today: users.filter(u => createdMs(u) >= dayAgo).length,
        allTime: users.length,
        thisWeek: users.filter(u => createdMs(u) >= weekAgo).length,
        thisMonth: users.filter(u => createdMs(u) >= monthAgo).length,
      },
      genderSplit,
      intentSplit,
      budgetSplit,
      ageDistribution,
      avgNps: avgNps.toFixed(1),
      avgRating: avgRating.toFixed(1),
      retentionRate,
      topDates,
      countryBreakdown,
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
