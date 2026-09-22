// Small in-memory stand-in for firebase/firestore used by the tests. It reproduces the
// behaviours the ERP depends on: transactions that buffer writes and apply them
// atomically, "reads before writes" enforcement, optimistic-concurrency retries, and
// documents that reject updates when missing.

const store = new Map(); // path -> { data, v }
let seq = 0;
export const hooks = { failOnPath: null, txAttempts: 0 };

export function __reset() {
  store.clear();
  seq = 0;
  hooks.failOnPath = null;
  hooks.txAttempts = 0;
}
export function __seed(path, data) {
  store.set(path, { data: resolve(data), v: 1 });
}
export function __get(path) {
  const e = store.get(path);
  return e ? clone(e.data) : undefined;
}
export function __list(colPath) {
  return [...store.entries()]
    .filter(([p]) => p.startsWith(`${colPath}/`) && !p.slice(colPath.length + 1).includes('/'))
    .map(([p, e]) => ({ id: p.split('/').pop(), ...clone(e.data) }));
}

class Ts {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
}
export const Timestamp = {
  now: () => new Ts(Date.now()),
  fromMillis: (ms) => new Ts(ms),
  fromDate: (d) => new Ts(d.getTime()),
};
// A class instance (like Firestore's FieldValue), so helpers that clone plain objects leave it intact.
class ServerTimestamp {}
const SERVER = new ServerTimestamp();
export const serverTimestamp = () => SERVER;

function resolve(v) {
  if (v instanceof ServerTimestamp) return new Ts(Date.now());
  if (v instanceof Ts) return v;
  if (Array.isArray(v)) return v.map(resolve);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => {
      if (x === undefined) throw new Error(`Unsupported field value: undefined (field "${k}")`);
      return [k, resolve(x)];
    }));
  }
  return v;
}
function clone(v) {
  if (v instanceof Ts) return v;
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
}

export function collection(_base, ...segs) {
  return { type: 'collection', path: segs.join('/') };
}
export function doc(base, ...segs) {
  if (base && base.type === 'collection') {
    const id = segs[0] ?? `auto${String(++seq).padStart(5, '0')}`;
    return { type: 'doc', path: `${base.path}/${id}`, id };
  }
  return { type: 'doc', path: segs.join('/'), id: segs[segs.length - 1] };
}

const snapOf = (path, id) => {
  const e = store.get(path);
  const r = { type: 'doc', path, id };
  return { id, ref: r, exists: () => !!e, data: () => (e ? clone(e.data) : undefined) };
};

export async function getDoc(r) {
  return snapOf(r.path, r.id);
}

export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const query = (col, ...constraints) => ({ type: 'query', path: col.path, constraints });

const val = (v) => (v instanceof Ts ? v.ms : v && typeof v.toMillis === 'function' ? v.toMillis() : v);
function matches(data, c) {
  const a = val(data[c.field]);
  const b = val(c.value);
  switch (c.op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case 'in': return b.includes(a);
    default: throw new Error(`unsupported op ${c.op}`);
  }
}
export async function getDocs(q) {
  const colPath = q.path;
  let rows = __list(colPath);
  const cons = q.constraints || [];
  cons.filter((c) => c.kind === 'where').forEach((c) => { rows = rows.filter((r) => matches(r, c)); });
  cons.filter((c) => c.kind === 'orderBy').forEach((c) => {
    rows.sort((x, y) => (val(x[c.field]) > val(y[c.field]) ? 1 : -1) * (c.dir === 'desc' ? -1 : 1));
  });
  const lim = cons.find((c) => c.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const docs = rows.map((r) => {
    const { id, ...data } = r;
    return { id, ref: { type: 'doc', path: `${colPath}/${id}`, id }, exists: () => true, data: () => clone(data) };
  });
  return { docs, empty: docs.length === 0, size: docs.length };
}

function applyWrite(staged, w) {
  const cur = staged.get(w.path);
  if (hooks.failOnPath && w.path === hooks.failOnPath) throw new Error(`forced failure writing ${w.path}`);
  if (w.op === 'set') {
    const data = resolve(w.data);
    staged.set(w.path, { data: w.opts?.merge && cur ? { ...cur.data, ...data } : data, v: (cur?.v || 0) + 1 });
  } else if (w.op === 'update') {
    if (!cur) throw new Error(`No document to update: ${w.path}`);
    staged.set(w.path, { data: { ...cur.data, ...resolve(w.data) }, v: cur.v + 1 });
  } else if (w.op === 'delete') {
    staged.delete(w.path);
  }
}
function commit(writes) {
  const staged = new Map(store);
  writes.forEach((w) => applyWrite(staged, w));
  store.clear();
  staged.forEach((v, k) => store.set(k, v));
}

export async function runTransaction(_db, fn) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    hooks.txAttempts += 1;
    const reads = new Map();
    const writes = [];
    const tx = {
      async get(r) {
        if (writes.length) throw new Error('Firestore transactions require all reads to be executed before all writes.');
        await new Promise((res) => setTimeout(res, 0));
        reads.set(r.path, store.get(r.path)?.v || 0);
        return snapOf(r.path, r.id);
      },
      set(r, data, opts) { writes.push({ op: 'set', path: r.path, data, opts }); return tx; },
      update(r, data) { writes.push({ op: 'update', path: r.path, data }); return tx; },
      delete(r) { writes.push({ op: 'delete', path: r.path }); return tx; },
    };
    const result = await fn(tx);
    let conflict = false;
    reads.forEach((v, p) => { if ((store.get(p)?.v || 0) !== v) conflict = true; });
    if (conflict) continue;
    if (writes.length > 500) throw new Error('Too many writes in one transaction');
    commit(writes);
    return result;
  }
  throw new Error('Transaction failed: too much contention');
}

export function writeBatch() {
  const writes = [];
  const b = {
    set(r, data, opts) { writes.push({ op: 'set', path: r.path, data, opts }); return b; },
    update(r, data) { writes.push({ op: 'update', path: r.path, data }); return b; },
    delete(r) { writes.push({ op: 'delete', path: r.path }); return b; },
    commit: async () => commit(writes),
  };
  return b;
}
export async function setDoc(r, data, opts) { commit([{ op: 'set', path: r.path, data, opts }]); }
export async function updateDoc(r, data) { commit([{ op: 'update', path: r.path, data }]); }
export async function addDoc(col, data) { const r = doc(col); commit([{ op: 'set', path: r.path, data }]); return r; }
export async function deleteDoc(r) { commit([{ op: 'delete', path: r.path }]); }

export const getFirestore = () => ({});
