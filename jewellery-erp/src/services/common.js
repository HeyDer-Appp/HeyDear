import { doc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_RULES, DEFAULT_COMPANY } from '../lib/constants';
import { AppError } from '../lib/errors';

export const ref = (...path) => doc(db, ...path);
export const newRef = (col) => doc(collection(db, col));
export const ts = () => serverTimestamp();

// Firestore rejects `undefined`; normalise to null.
export function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v === undefined ? null : clean(v)]));
  }
  return value === undefined ? null : value;
}

export function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function txRules(tx) {
  const s = await tx.get(ref('settings', 'rules'));
  return { ...DEFAULT_RULES, ...(s.exists() ? s.data() : {}) };
}

export async function txCompany(tx) {
  const s = await tx.get(ref('settings', 'company'));
  return { ...DEFAULT_COMPANY, ...(s.exists() ? s.data() : {}) };
}

export async function txCounter(tx, name) {
  const s = await tx.get(ref('counters', name));
  return s.exists() ? Number(s.data().value) || 0 : 0;
}

export const setCounter = (tx, name, value) => tx.set(ref('counters', name), { value });

export function requireDoc(snap, what) {
  if (!snap.exists()) throw new AppError('NOT_FOUND', `${what} not found.`);
  return { id: snap.id, ...snap.data() };
}

export function requireReason(reason, what = 'A reason') {
  const r = String(reason || '').trim();
  if (r.length < 3) throw new AppError('VALIDATION', `${what} is required.`);
  return r;
}

export function stageAudit(tx, actor, { action, entityType, entityId, oldValue = null, newValue = null, reason = null, branchId = null }) {
  tx.set(
    newRef('auditLogs'),
    clean({
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      reason,
      branchId,
      userId: actor.uid,
      userName: actor.name,
      userRole: actor.role,
      createdAt: ts(),
    }),
  );
}

export function stageMovement(tx, actor, m) {
  tx.set(
    newRef('movements'),
    clean({
      productId: m.productId,
      type: m.type,
      fromBranchId: m.fromBranchId ?? null,
      toBranchId: m.toBranchId ?? null,
      statusFrom: m.statusFrom ?? null,
      statusTo: m.statusTo ?? null,
      refType: m.refType ?? null,
      refId: m.refId ?? null,
      reason: m.reason ?? null,
      userId: actor.uid,
      userName: actor.name,
      createdAt: ts(),
    }),
  );
}
