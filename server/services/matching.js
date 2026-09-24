// Automatic group allocation for a dinner.
//
// Hard rules (from the founder):
//   - table size 6–7 (a 4–5 table only when the numbers force it)
//   - gender split only 3:3, 3:2/2:3, 4:2/2:4, 2:2, 2:5/5:2, 4:3/3:4 — never a
//     lone person of either gender
//   - age spread at most 10 years per table (aim for 7)
//   - budget the same or an adjacent tier
// Softer preferences: a mix of outgoing/reserved people, the same intent
// (meaningful friendships vs a fun night), varied group roles, not re-seating
// people who've already met, and — once there is feedback — whatever the
// learning step has found makes tables people rate highly.

const ALLOWED_SPLITS = [[2, 2], [2, 3], [3, 2], [3, 3], [2, 4], [4, 2], [2, 5], [5, 2], [3, 4], [4, 3]];
const ALLOWED = new Set(ALLOWED_SPLITS.map(([m, f]) => `${m}:${f}`));
const MAX_AGE_SPREAD = 10;
const TARGET_AGE_SPREAD = 7;

function isAllowedSplit(m, f) { return ALLOWED.has(`${m}:${f}`); }

function normGender(g) {
  if (/^m/i.test(g || '')) return 'M';
  if (/^f/i.test(g || '')) return 'F';
  return 'X';
}

function ageOf(dob) {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
}

// '$45-$50' -> 9, '$50-$55' -> 10 (steps of $5), so neighbouring tiers differ by 1.
function budgetTier(b) {
  if (!b) return null;
  const digits = String(b).match(/\d+/);
  if (digits) return Math.round(Number(digits[0]) / 5);
  const dollars = (String(b).match(/\$/g) || []).length;
  return dollars || null;
}

// ---------- composition planning: how many men/women at each table ----------

const sizeCost = (n) => (n >= 6 ? 0 : n === 5 ? 3 : 8) + Math.abs(n - 6.5) * 0.01;

function planComposition(M, F) {
  const memo = new Map();
  const solve = (m, f) => {
    if (m === 0 && f === 0) return { cost: 0, specs: [] };
    const key = `${m}:${f}`;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (const [sm, sf] of ALLOWED_SPLITS) {
      if (sm > m || sf > f) continue;
      const rest = solve(m - sm, f - sf);
      if (!rest) continue;
      const cost = sizeCost(sm + sf) + rest.cost;
      if (!best || cost < best.cost) best = { cost, specs: [[sm, sf], ...rest.specs] };
    }
    memo.set(key, best);
    return best;
  };

  // If the numbers can't be split legally, leave out as few people as possible.
  for (let drop = 0; drop <= 8; drop++) {
    let bestPlan = null;
    for (let dm = 0; dm <= drop; dm++) {
      const df = drop - dm;
      if (dm > M || df > F) continue;
      const plan = solve(M - dm, F - df);
      if (plan && (!bestPlan || plan.cost < bestPlan.plan.cost)) bestPlan = { plan, dm, df };
    }
    if (bestPlan) return { specs: bestPlan.plan.specs, dropM: bestPlan.dm, dropF: bestPlan.df };
  }
  return { specs: [], dropM: M, dropF: F };
}

// ---------- scoring ----------

function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

function metricsOf(members) {
  const ages = members.map((m) => m.age).filter((a) => a !== null);
  const tiers = members.map((m) => m.tier).filter((t) => t !== null);
  const roles = members.map((m) => m.raw.group_role).filter(Boolean);
  return {
    size: members.length,
    men: members.filter((m) => m.slot === 'M').length,
    women: members.filter((m) => m.slot === 'F').length,
    ageRange: ages.length ? Math.max(...ages) - Math.min(...ages) : 0,
    budgetSpread: tiers.length ? Math.max(...tiers) - Math.min(...tiers) : 0,
    outgoing: members.filter((m) => m.raw.personality === 'Outgoing').length,
    reserved: members.filter((m) => m.raw.personality === 'Reserved').length,
    intents: new Set(members.map((m) => m.raw.intent).filter(Boolean)).size,
    minorityIntent: (() => {
      const c = {};
      members.forEach((m) => { if (m.raw.intent) c[m.raw.intent] = (c[m.raw.intent] || 0) + 1; });
      const v = Object.values(c);
      return v.length > 1 ? members.length - Math.max(...v) : 0;
    })(),
    distinctRoles: new Set(roles).size,
    roleCount: roles.length,
  };
}

// Feature buckets shared with the learning step, so what it learns is
// exactly what the allocator can act on.
function tableFeatures(members) {
  const mt = metricsOf(members);
  return {
    age_spread: mt.ageRange <= 4 ? '0-4 yrs' : mt.ageRange <= 7 ? '5-7 yrs' : mt.ageRange <= 10 ? '8-10 yrs' : '10+ yrs',
    gender_balance: Math.abs(mt.men - mt.women) <= 1 ? 'even split' : 'lopsided split',
    budget: mt.budgetSpread === 0 ? 'same budget' : mt.budgetSpread === 1 ? 'adjacent budgets' : 'far-apart budgets',
    intent: mt.intents <= 1 ? 'same intent' : 'mixed intent',
    size: mt.size <= 5 ? 'small (4-5)' : mt.size === 6 ? '6 people' : '7 people',
    personality: mt.outgoing > 0 && mt.reserved > 0 ? 'outgoing + reserved mix' : 'one personality type',
  };
}

function tableCost(members, ctx) {
  const mt = metricsOf(members);
  let cost = 0;
  if (mt.ageRange > MAX_AGE_SPREAD) cost += 1000 + (mt.ageRange - MAX_AGE_SPREAD) * 200;
  else if (mt.ageRange > TARGET_AGE_SPREAD) cost += (mt.ageRange - TARGET_AGE_SPREAD) * 18;
  cost += mt.ageRange * 0.8;
  if (mt.budgetSpread > 1) cost += 1000 * (mt.budgetSpread - 1);
  else if (mt.budgetSpread === 1) cost += 1;
  if (mt.outgoing === 0) cost += 7;
  if (mt.reserved === mt.size) cost += 7;
  if (Math.abs(mt.outgoing - mt.reserved) >= mt.size - 1) cost += 4;
  cost += mt.minorityIntent * 5;
  cost -= Math.min(mt.distinctRoles, 5) * 0.8;
  const rel = members.map((m) => Number(m.raw.reliability_score)).filter((r) => !Number.isNaN(r));
  if (rel.length > 1 && Math.max(...rel) - Math.min(...rel) > 4) cost += 3;

  if (ctx.history) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const h = ctx.history.get(pairKey(members[i].id, members[j].id));
        if (h) cost += h.together * 12 + h.lowFit * 6;
      }
    }
  }
  if (ctx.learnedFn) cost -= ctx.learnedWeight * ctx.learnedFn(tableFeatures(members)) * 12;
  return cost;
}

// ---------- validation (also used to warn the admin about hand-edited tables) ----------

function validateTable(rawMembers) {
  const members = rawMembers.map((raw) => ({ id: raw.user_id || raw.id, raw, slot: normGender(raw.gender), age: ageOf(raw.dob), tier: budgetTier(raw.budget) }));
  const mt = metricsOf(members);
  const issues = [];
  const x = members.filter((m) => m.slot === 'X').length;
  const n = members.length;

  if (n > 7) issues.push({ level: 'red', code: 'size', msg: `${n} people — max is 7` });
  else if (n > 0 && n < 4) issues.push({ level: 'red', code: 'size', msg: `Only ${n} people — needs at least 4` });
  else if (n > 0 && n < 6) issues.push({ level: 'yellow', code: 'size', msg: `${n} people — aim for 6–7` });

  if (n >= 2) {
    let okSplit = false;
    for (let toM = 0; toM <= x; toM++) if (isAllowedSplit(mt.men + toM, mt.women + (x - toM))) okSplit = true;
    if (!okSplit) {
      const m = mt.men, f = mt.women;
      const lone = m === 1 ? 'a lone man' : f === 1 ? 'a lone woman' : m === 0 ? 'no men' : f === 0 ? 'no women' : 'a gender split outside the allowed set';
      issues.push({ level: 'red', code: 'gender', msg: `${m} men / ${f} women — ${lone}` });
    }
  }
  if (mt.ageRange > MAX_AGE_SPREAD) issues.push({ level: 'red', code: 'age', msg: `Age spread ${Math.round(mt.ageRange)} yrs (max ${MAX_AGE_SPREAD})` });
  else if (mt.ageRange > TARGET_AGE_SPREAD) issues.push({ level: 'yellow', code: 'age', msg: `Age spread ${Math.round(mt.ageRange)} yrs (aim ≤ ${TARGET_AGE_SPREAD})` });
  if (mt.budgetSpread > 1) issues.push({ level: 'red', code: 'budget', msg: 'Budgets are more than one tier apart' });
  return { issues, metrics: { size: n, men: mt.men, women: mt.women, ageRange: Math.round(mt.ageRange * 10) / 10, budgetSpread: mt.budgetSpread } };
}

// ---------- the allocator ----------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function matchGroups(rawPeople, opts = {}) {
  const { seed = 1, restarts = 6, iterations = 12000, history = null, learnedFn = null, learnedWeight = 1 } = opts;
  const ctx = { history, learnedFn, learnedWeight };

  const people = rawPeople.map((raw) => ({ id: raw.id || raw.user_id, raw, g: normGender(raw.gender), age: ageOf(raw.dob), tier: budgetTier(raw.budget), slot: null, at: raw.submitted_at?.toMillis?.() || 0 }));
  const M = people.filter((p) => p.g === 'M');
  const F = people.filter((p) => p.g === 'F');
  // Anyone who isn't male/female fills whichever side is smaller.
  people.filter((p) => p.g === 'X').forEach((p) => { (M.length <= F.length ? M : F).push(p); });
  M.forEach((p) => { p.slot = 'M'; });
  F.forEach((p) => { p.slot = 'F'; });

  const { specs, dropM, dropF } = planComposition(M.length, F.length);

  // Whoever can't be seated legally is the most recent signup on that side.
  const unplaced = [];
  const dropFrom = (pool, k, reason) => {
    pool.sort((a, b) => b.at - a.at);
    for (let i = 0; i < k; i++) { const p = pool.shift(); unplaced.push({ id: p.id, reason }); }
  };
  dropFrom(M, dropM, 'No legal gender split left for them (never a lone man or woman at a table)');
  dropFrom(F, dropF, 'No legal gender split left for them (never a lone man or woman at a table)');
  if (!specs.length) return { tables: [], unplaced, score: 0, warnings: [] };

  const byAge = (a, b) => (a.age ?? 30) - (b.age ?? 30);
  let best = null;

  for (let r = 0; r < restarts; r++) {
    const rand = mulberry32(seed * 1000 + r * 7919 + 13);
    const men = M.slice().sort(byAge);
    const women = F.slice().sort(byAge);
    if (r > 0) {
      // Restarts begin from a nudged version of the age-sorted start.
      for (let i = 0; i < Math.floor(men.length / 2); i++) { const a = Math.floor(rand() * men.length), b = Math.floor(rand() * men.length); [men[a], men[b]] = [men[b], men[a]]; }
      for (let i = 0; i < Math.floor(women.length / 2); i++) { const a = Math.floor(rand() * women.length), b = Math.floor(rand() * women.length); [women[a], women[b]] = [women[b], women[a]]; }
    }
    // Age-sorted chunks: younger tables get the younger men and women.
    const order = specs.map((s, i) => i).sort((a, b) => (specs[a][0] + specs[a][1]) - (specs[b][0] + specs[b][1]));
    let mi = 0, fi = 0;
    const tables = specs.map(() => []);
    order.forEach((ti) => {
      const [sm, sf] = specs[ti];
      tables[ti] = [...men.slice(mi, mi + sm), ...women.slice(fi, fi + sf)];
      mi += sm; fi += sf;
    });

    const costs = tables.map((t) => tableCost(t, ctx));
    let total = costs.reduce((a, b) => a + b, 0);
    let bestLocal = { total, tables: tables.map((t) => t.slice()) };

    if (tables.length > 1) {
      let T = 6;
      const cool = Math.pow(0.02 / 6, 1 / iterations);
      for (let it = 0; it < iterations; it++, T *= cool) {
        const a = Math.floor(rand() * tables.length);
        let b = Math.floor(rand() * (tables.length - 1)); if (b >= a) b++;
        const slot = rand() < 0.5 ? 'M' : 'F';
        const ia = tables[a].map((p, i) => (p.slot === slot ? i : -1)).filter((i) => i >= 0);
        const ib = tables[b].map((p, i) => (p.slot === slot ? i : -1)).filter((i) => i >= 0);
        if (!ia.length || !ib.length) continue;
        const pa = ia[Math.floor(rand() * ia.length)], pb = ib[Math.floor(rand() * ib.length)];
        const x = tables[a][pa], y = tables[b][pb];
        tables[a][pa] = y; tables[b][pb] = x;
        const na = tableCost(tables[a], ctx), nb = tableCost(tables[b], ctx);
        const delta = (na + nb) - (costs[a] + costs[b]);
        if (delta <= 0 || rand() < Math.exp(-delta / T)) {
          costs[a] = na; costs[b] = nb; total += delta;
          if (total < bestLocal.total - 1e-9) bestLocal = { total, tables: tables.map((t) => t.slice()) };
        } else {
          tables[a][pa] = x; tables[b][pb] = y;
        }
      }
    }
    if (!best || bestLocal.total < best.total) best = bestLocal;
  }

  const outTables = best.tables.map((t) => t.map((p) => p.id));
  const warnings = [];
  best.tables.forEach((t, i) => {
    const v = validateTable(t.map((p) => ({ ...p.raw, user_id: p.id })));
    v.issues.forEach((iss) => warnings.push({ table: i, ...iss }));
  });
  return { tables: outTables, unplaced, score: Math.round(best.total * 10) / 10, warnings };
}

module.exports = { matchGroups, validateTable, tableFeatures, planComposition, isAllowedSplit, budgetTier, ageOf, normGender, pairKey, ALLOWED_SPLITS };
