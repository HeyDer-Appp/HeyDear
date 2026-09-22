import { runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError } from '../lib/errors';
import { P, assertCan } from '../lib/permissions';
import { pad } from '../lib/format';
import { r2 } from '../lib/money';
import { clean, ref, requireDoc, setCounter, stageAudit, stageMovement, ts, txCounter } from './common';

export const MAX_PIECES_PER_CALL = 200; // 2 writes per piece must stay under Firestore's 500-write limit

const num = (v) => Number(v) || 0;

export function normalizeItem(it) {
  const item = {
    name: String(it.name || '').trim(),
    category: it.category || 'Other',
    metal: it.metal || 'Gold',
    purity: it.purity || '22K',
    grossWeight: num(it.grossWeight),
    netWeight: num(it.netWeight),
    huid: String(it.huid || '').trim(),
    price: r2(it.price),
  };
  if (!item.name) throw new AppError('VALIDATION', 'Every item needs a name.');
  if (item.price <= 0) throw new AppError('VALIDATION', `"${item.name}" needs a price above 0.`);
  if (item.grossWeight > 0 && item.netWeight > item.grossWeight) throw new AppError('VALIDATION', `"${item.name}": net weight cannot be more than gross weight.`);
  return item;
}

/**
 * Add new pieces to one branch. Each piece gets its own permanent Product ID
 * (JWL-000001…). `items` may carry `qty` to create several identical pieces.
 * Used by both "Add product" and the CSV upload.
 */
export async function addProducts(actor, { branchId, items, note }) {
  assertCan(actor, P.MANAGE_STOCK);
  if (!branchId) throw new AppError('VALIDATION', 'Choose a branch.');
  const pieces = [];
  (items || []).forEach((raw) => {
    const item = normalizeItem(raw);
    const qty = raw.qty === undefined || raw.qty === '' ? 1 : Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1) throw new AppError('VALIDATION', `"${item.name}": quantity must be a whole number.`);
    for (let i = 0; i < qty; i += 1) pieces.push(item);
  });
  if (!pieces.length) throw new AppError('VALIDATION', 'Add at least one item.');
  if (pieces.length > MAX_PIECES_PER_CALL) throw new AppError('VALIDATION', `Add at most ${MAX_PIECES_PER_CALL} pieces at a time.`);

  return runTransaction(db, async (tx) => {
    const [branchSnap, seq] = await Promise.all([tx.get(ref('branches', branchId)), txCounter(tx, 'products')]);
    const branch = requireDoc(branchSnap, 'Branch');
    if (branch.active === false) throw new AppError('VALIDATION', 'This branch is inactive.');
    setCounter(tx, 'products', seq + pieces.length);
    const ids = pieces.map((item, i) => {
      const id = `JWL-${pad(seq + i + 1)}`;
      tx.set(ref('products', id), clean({ ...item, branchId, status: 'AVAILABLE', soldInvoiceId: null, createdBy: actor.uid, createdAt: ts(), updatedAt: ts() }));
      stageMovement(tx, actor, { productId: id, type: 'ADDED', toBranchId: branchId, statusTo: 'AVAILABLE', reason: note || null });
      return id;
    });
    stageAudit(tx, actor, { action: 'STOCK_ADDED', entityType: 'branch', entityId: branchId, branchId, reason: note || null, newValue: { pieces: ids.length, from: ids[0], to: ids[ids.length - 1] } });
    return ids;
  });
}

/** Owner sends pieces to a branch. It happens immediately - no approval or receiving steps. */
export async function distributeProducts(actor, { productIds, toBranchId }) {
  assertCan(actor, P.MANAGE_STOCK);
  const ids = [...new Set(productIds || [])];
  if (!ids.length) throw new AppError('VALIDATION', 'Select the pieces to move.');
  if (ids.length > MAX_PIECES_PER_CALL) throw new AppError('VALIDATION', `Move at most ${MAX_PIECES_PER_CALL} pieces at a time.`);
  if (!toBranchId) throw new AppError('VALIDATION', 'Choose the branch to send them to.');

  return runTransaction(db, async (tx) => {
    const [toSnap, ...snaps] = await Promise.all([tx.get(ref('branches', toBranchId)), ...ids.map((id) => tx.get(ref('products', id)))]);
    const to = requireDoc(toSnap, 'Branch');
    if (to.active === false) throw new AppError('VALIDATION', 'That branch is inactive.');
    const products = snaps.map((s) => {
      const p = requireDoc(s, 'Product');
      if (p.status !== 'AVAILABLE') throw new AppError('UNAVAILABLE', `${p.name} (${p.id}) is ${p.status.toLowerCase()} and cannot be moved.`);
      if (p.branchId === toBranchId) throw new AppError('VALIDATION', `${p.name} (${p.id}) is already at ${to.name}.`);
      return p;
    });
    products.forEach((p) => {
      tx.update(ref('products', p.id), { branchId: toBranchId, updatedAt: ts() });
      stageMovement(tx, actor, { productId: p.id, type: 'DISTRIBUTED', fromBranchId: p.branchId, toBranchId, statusFrom: 'AVAILABLE', statusTo: 'AVAILABLE' });
    });
    stageAudit(tx, actor, { action: 'STOCK_DISTRIBUTED', entityType: 'branch', entityId: toBranchId, branchId: toBranchId, newValue: { pieces: products.length, ids: ids.slice(0, 20) } });
    return products.length;
  });
}

/** Take a wrongly-added, unsold piece out of stock. The record and its history stay. */
export async function removeProduct(actor, productId, reason) {
  assertCan(actor, P.MANAGE_STOCK);
  const why = String(reason || '').trim();
  if (why.length < 3) throw new AppError('VALIDATION', 'A reason is required.');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref('products', productId));
    const p = requireDoc(snap, 'Product');
    if (p.status !== 'AVAILABLE') throw new AppError('INVALID_STATE', 'Only unsold pieces can be removed.');
    tx.update(snap.ref, { status: 'REMOVED', updatedAt: ts() });
    stageMovement(tx, actor, { productId, type: 'REMOVED', fromBranchId: p.branchId, statusFrom: 'AVAILABLE', statusTo: 'REMOVED', reason: why });
    stageAudit(tx, actor, { action: 'PRODUCT_REMOVED', entityType: 'product', entityId: productId, branchId: p.branchId, reason: why });
    return true;
  });
}

const EDITABLE_TEXT = ['name', 'category', 'metal', 'purity', 'huid'];

export async function updateProduct(actor, productId, patch, reason) {
  assertCan(actor, P.MANAGE_STOCK);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref('products', productId));
    const p = requireDoc(snap, 'Product');
    if (p.status !== 'AVAILABLE') throw new AppError('INVALID_STATE', 'Only unsold pieces can be edited.');
    const next = {};
    EDITABLE_TEXT.forEach((k) => { if (patch[k] !== undefined) next[k] = String(patch[k]).trim(); });
    ['grossWeight', 'netWeight'].forEach((k) => { if (patch[k] !== undefined) next[k] = num(patch[k]); });
    if (next.name === '') throw new AppError('VALIDATION', 'Name cannot be empty.');
    const gross = next.grossWeight ?? p.grossWeight;
    const net = next.netWeight ?? p.netWeight;
    if (gross > 0 && net > gross) throw new AppError('VALIDATION', 'Net weight cannot be more than gross weight.');
    let priceChanged = false;
    if (patch.price !== undefined && r2(patch.price) !== p.price) {
      next.price = r2(patch.price);
      if (next.price <= 0) throw new AppError('VALIDATION', 'Price must be above 0.');
      if (String(reason || '').trim().length < 3) throw new AppError('VALIDATION', 'A reason is required when the price changes.');
      priceChanged = true;
    }
    tx.update(snap.ref, clean({ ...next, updatedAt: ts() }));
    if (priceChanged) {
      stageAudit(tx, actor, { action: 'PRICE_CHANGED', entityType: 'product', entityId: productId, branchId: p.branchId, reason, oldValue: { price: p.price }, newValue: { price: next.price } });
    }
    return true;
  });
}
