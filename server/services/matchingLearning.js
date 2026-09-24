// Learns from what diners say after a dinner.
//
// Every feedback response is tied back to the table that person sat at and
// the make-up of that table (age spread, gender balance, budgets, intent,
// personality mix, size). Tables are then compared: which makeups earn
// higher "how well did the group fit" ratings? That becomes a small nudge
// the allocator adds when it scores a candidate table. It also remembers who
// has already sat together (don't repeat) and pairs whose table was rated
// poorly (avoid re-seating them).
//
// Deliberately simple and explainable — every number the allocator uses is
// shown to the admin as a plain sentence, and it does nothing until there is
// enough feedback (SHRINK makes small samples count for very little).

const { db } = require('../firebase');
const { tableFeatures, pairKey } = require('./matching');

const SHRINK = 6;       // "pseudo-responses" of doubt: 3 responses barely move things, 30 clearly do
const CAP = 1.5;        // never let learning shift a table's expected rating by more than 1.5 stars
const MIN_RESPONSES = 8;

const FEATURE_LABEL = {
  age_spread: 'Age spread',
  gender_balance: 'Gender split',
  budget: 'Budgets',
  intent: 'Intent',
  size: 'Table size',
  personality: 'Personality mix',
};

function satisfaction(f) {
  const vals = [f.group_fit, f.overall_rating].filter((v) => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

async function loadTables() {
  // Only tables that actually went ahead (confirmed) count as history —
  // draft tables the admin is still shuffling must not make people look like
  // they have already met.
  const [membersSnap, feedbackSnap, confirmedSnap] = await Promise.all([
    db.collection('tableMembers').get(),
    db.collection('feedback').get(),
    db.collection('tables').where('status', '==', 'confirmed').get(),
  ]);
  const confirmed = new Set(confirmedSnap.docs.map((d) => d.id));
  const byTable = new Map();
  const memberOf = new Map(); // `${dinnerId}|${userId}` -> tableId
  membersSnap.docs.forEach((d) => {
    const m = d.data();
    if (!m.tableId || !m.user_id || !confirmed.has(m.tableId)) return;
    if (!byTable.has(m.tableId)) byTable.set(m.tableId, []);
    byTable.get(m.tableId).push({ user_id: m.user_id, gender: m.gender, dob: m.dob, budget: m.budget, intent: m.intent, personality: m.personality, group_role: m.group_role, dinnerId: m.dinnerId });
    memberOf.set(`${m.dinnerId}|${m.user_id}`, m.tableId);
  });
  return { byTable, memberOf, feedback: feedbackSnap.docs.map((d) => d.data()) };
}

function asMatchMembers(rows) {
  return rows.map((r) => ({ id: r.user_id, raw: r, slot: /^m/i.test(r.gender || '') ? 'M' : 'F', age: r.dob ? (Date.now() - new Date(r.dob).getTime()) / (365.25 * 864e5) : null, tier: null }));
}

function tierOf(b) {
  const digits = String(b || '').match(/\d+/);
  if (digits) return Math.round(Number(digits[0]) / 5);
  return (String(b || '').match(/\$/g) || []).length || null;
}

async function buildInsights() {
  const { byTable, memberOf, feedback } = await loadTables();

  const samples = []; // { features, score }
  const lowFitTables = new Set();
  const tableScores = new Map();
  for (const f of feedback) {
    const score = satisfaction(f);
    const tableId = memberOf.get(`${f.dinnerId}|${f.userId}`);
    if (score === null || !tableId || !byTable.has(tableId)) continue;
    if (!tableScores.has(tableId)) tableScores.set(tableId, []);
    tableScores.get(tableId).push(score);
    const rows = byTable.get(tableId).map((r) => ({ ...r, tier: tierOf(r.budget) }));
    const members = rows.map((r) => ({ id: r.user_id, raw: r, slot: /^m/i.test(r.gender || '') ? 'M' : 'F', age: r.dob ? (Date.now() - new Date(r.dob).getTime()) / (365.25 * 864e5) : null, tier: r.tier }));
    samples.push({ features: tableFeatures(members), score });
    if (typeof f.group_fit === 'number' && f.group_fit <= 2) lowFitTables.add(tableId);
  }

  const n = samples.length;
  const globalMean = n ? samples.reduce((a, s) => a + s.score, 0) / n : null;

  const buckets = {};
  samples.forEach(({ features, score }) => {
    Object.entries(features).forEach(([feature, bucket]) => {
      const key = `${feature}::${bucket}`;
      (buckets[key] ||= { feature, bucket, n: 0, sum: 0 });
      buckets[key].n += 1; buckets[key].sum += score;
    });
  });
  const list = Object.values(buckets).map((b) => {
    const mean = b.sum / b.n;
    const delta = globalMean === null ? 0 : (b.n * (mean - globalMean)) / (b.n + SHRINK);
    return { feature: b.feature, label: FEATURE_LABEL[b.feature], bucket: b.bucket, n: b.n, mean: Math.round(mean * 100) / 100, delta: Math.round(delta * 100) / 100 };
  }).sort((a, b) => a.feature.localeCompare(b.feature) || b.mean - a.mean);

  // People who've sat together before, and pairs from tables rated poorly.
  const history = new Map();
  for (const [tableId, rows] of byTable) {
    const ids = rows.map((r) => r.user_id);
    const low = lowFitTables.has(tableId);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        const h = history.get(k) || { together: 0, lowFit: 0 };
        h.together += 1; if (low) h.lowFit += 1;
        history.set(k, h);
      }
    }
  }

  const enough = n >= MIN_RESPONSES;
  const byName = new Map(list.map((b) => [`${b.feature}::${b.bucket}`, b.delta]));
  const learnedFn = enough
    ? (features) => {
        let sum = 0;
        Object.entries(features).forEach(([feature, bucket]) => { sum += byName.get(`${feature}::${bucket}`) || 0; });
        return Math.max(-CAP, Math.min(CAP, sum));
      }
    : null;

  // Plain-language takeaways for the admin panel.
  const sentences = [];
  const byFeature = {};
  list.forEach((b) => { (byFeature[b.feature] ||= []).push(b); });
  Object.values(byFeature).forEach((bs) => {
    const usable = bs.filter((b) => b.n >= 3);
    if (usable.length < 2) return;
    const top = usable[0], bottom = usable[usable.length - 1];
    if (top.mean - bottom.mean >= 0.3) {
      sentences.push(`${top.label}: "${top.bucket}" tables are rated ${top.mean.toFixed(1)}★ vs ${bottom.mean.toFixed(1)}★ for "${bottom.bucket}" (${top.n} and ${bottom.n} responses).`);
    }
  });

  return {
    responses: n,
    globalMean: globalMean === null ? null : Math.round(globalMean * 100) / 100,
    ready: enough,
    minResponses: MIN_RESPONSES,
    tablesRated: tableScores.size,
    pairsRemembered: history.size,
    buckets: list,
    sentences,
    history,
    learnedFn,
  };
}

// The part sent to the admin UI (no functions / maps).
function publicInsights(ins) {
  const { history, learnedFn, ...rest } = ins;
  return rest;
}

module.exports = { buildInsights, publicInsights, MIN_RESPONSES };
