import { runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError } from '../lib/errors';
import { PAYMENT_MODES } from '../lib/constants';
import { P, assertBranch, assertCan } from '../lib/permissions';
import { calcBill } from '../lib/calc';
import { OFFER_MSG, checkOldBill } from '../lib/offer';
import { pad } from '../lib/format';
import { r2 } from '../lib/money';
import { clean, newToken, ref, requireDoc, requireReason, setCounter, stageAudit, stageMovement, ts, txCompany, txCounter, txRules } from './common';

function normalizePayments(payments) {
  return (payments || [])
    .map((p) => ({ mode: p.mode, amount: r2(p.amount), ref: String(p.ref || '').trim() }))
    .filter((p) => p.amount !== 0)
    .map((p) => {
      if (!PAYMENT_MODES.includes(p.mode)) throw new AppError('VALIDATION', 'Choose a valid payment mode.');
      if (p.amount < 0) throw new AppError('VALIDATION', 'Payment amounts must be positive.');
      return p;
    });
}

const publicItem = (i) => ({ productId: i.productId, name: i.name, metal: i.metal, purity: i.purity, netWeight: i.netWeight, price: i.price });

/**
 * One transaction creates the bill. It:
 *  - marks every piece SOLD and writes stock movements,
 *  - if an old bill is used for the offer, gives the discount and EXPIRES that old bill,
 *  - writes the secure QR record.
 * If any step fails nothing is written.
 *
 * input: { branchId, customerId, productIds, offer: { oldInvoiceId } | null, payments, notes }
 */
export async function completeSale(actor, input) {
  const { branchId, customerId, productIds = [], notes = '' } = input;
  assertCan(actor, P.CREATE_BILL);
  assertBranch(actor, branchId);
  if (!branchId) throw new AppError('VALIDATION', 'Select the branch you are billing from.');
  if (!customerId) throw new AppError('VALIDATION', 'Select or add the customer first.');
  const ids = [...new Set(productIds)];
  if (!ids.length) throw new AppError('VALIDATION', 'Add at least one piece to the bill.');
  if (ids.length !== productIds.length) throw new AppError('VALIDATION', 'The same piece was added twice.');
  if (ids.length > 50) throw new AppError('VALIDATION', 'A bill can hold at most 50 pieces.');
  const oldInvoiceId = input.offer?.oldInvoiceId ? String(input.offer.oldInvoiceId).trim().toUpperCase() : '';
  const payments = normalizePayments(input.payments);
  const token = newToken();

  return runTransaction(db, async (tx) => {
    // ------------------------------------------------------------ reads
    const [rules, company, branchSnap, custSnap, seq, ...prodSnaps] = await Promise.all([
      txRules(tx),
      txCompany(tx),
      tx.get(ref('branches', branchId)),
      tx.get(ref('customers', customerId)),
      txCounter(tx, `inv_${branchId}`),
      ...ids.map((id) => tx.get(ref('products', id))),
    ]);
    let oldSnap = null;
    let oldPublicSnap = null;
    if (oldInvoiceId) {
      oldSnap = await tx.get(ref('invoices', oldInvoiceId));
      if (oldSnap.exists() && oldSnap.data().qrToken) oldPublicSnap = await tx.get(ref('publicInvoices', oldSnap.data().qrToken));
    }

    // ------------------------------------------------------------ checks
    const branch = requireDoc(branchSnap, 'Branch');
    if (branch.active === false) throw new AppError('VALIDATION', 'This branch is inactive.');
    const customer = requireDoc(custSnap, 'Customer');

    const items = prodSnaps.map((s, i) => {
      if (!s.exists()) throw new AppError('NOT_FOUND', `Product ${ids[i]} not found.`);
      const p = { id: s.id, ...s.data() };
      if (p.status !== 'AVAILABLE') throw new AppError('UNAVAILABLE', `${p.name} (${p.id}) is not available - it is ${p.status.toLowerCase()}.`);
      if (p.branchId !== branchId) throw new AppError('UNAVAILABLE', `${p.name} (${p.id}) is not in stock at this branch.`);
      return { productId: p.id, name: p.name, category: p.category, metal: p.metal, purity: p.purity, grossWeight: p.grossWeight || 0, netWeight: p.netWeight || 0, huid: p.huid || '', price: p.price };
    });
    const subtotal = r2(items.reduce((s, i) => s + i.price, 0));

    let offer = null;
    let oldInvoice = null;
    if (oldInvoiceId) {
      oldInvoice = oldSnap.exists() ? { id: oldSnap.id, ...oldSnap.data() } : null;
      const problem = checkOldBill(oldInvoice, rules.offerPercent);
      if (problem) throw new AppError(problem.code, problem.message);
      offer = { type: 'OLD_BILL', oldInvoiceId: oldInvoice.id, oldBranchId: oldInvoice.branchId, percent: rules.offerPercent };
    }

    const bill = calcBill({ subtotal, offerPercent: offer ? rules.offerPercent : 0, oldBillAmount: offer ? oldInvoice.total : null, gstPercent: rules.gstPercent });
    const paid = r2(payments.reduce((s, p) => s + p.amount, 0));
    if (paid > bill.total) throw new AppError('VALIDATION', 'Payments are more than the bill total.');
    if (paid < bill.total) throw new AppError('VALIDATION', `Payment is short by ${r2(bill.total - paid)}. Bills must be paid in full.`);

    // ------------------------------------------------------------ writes
    const invoiceNo = `${branch.code}-INV-${pad(seq + 1)}`;
    setCounter(tx, `inv_${branchId}`, seq + 1);
    if (offer) offer.amount = bill.discount;

    tx.set(
      ref('invoices', invoiceNo),
      clean({
        invoiceNo, status: 'ACTIVE', branchId, branchCode: branch.code, branchName: branch.name, customerId,
        customer: { name: customer.name, mobile: customer.mobile, address: customer.address || '' },
        items, ...bill, payments, paidAmount: paid, offer,
        offerUsedBy: null, offerUsedAt: null, // set when THIS bill is used for a later 50% offer
        notes: String(notes || '').trim(), qrToken: token, createdBy: actor.uid, createdByName: actor.name, createdAt: ts(),
      }),
    );
    tx.set(
      ref('publicInvoices', token),
      clean({
        invoiceId: invoiceNo, invoiceNo, status: 'ACTIVE', branchName: branch.name, companyName: company.name,
        items: items.map(publicItem), subtotal: bill.subtotal, discount: bill.discount, tax: bill.tax, total: bill.total,
        offerPercent: rules.offerPercent, canGiveOffer: !offer, offerUsed: false, createdAt: ts(), updatedAt: ts(),
      }),
    );
    items.forEach((i) => {
      tx.update(ref('products', i.productId), { status: 'SOLD', soldInvoiceId: invoiceNo, soldBranchId: branchId, soldToCustomerId: customerId, soldAt: ts(), updatedAt: ts() });
      stageMovement(tx, actor, { productId: i.productId, type: 'SALE', fromBranchId: branchId, statusFrom: 'AVAILABLE', statusTo: 'SOLD', refType: 'invoice', refId: invoiceNo });
    });
    tx.update(ref('customers', customerId), {
      totalSpent: r2((customer.totalSpent || 0) + bill.total), billCount: (customer.billCount || 0) + 1, lastPurchaseAt: ts(),
    });

    if (offer) {
      // The old bill is used up: it can never give the offer again.
      tx.update(ref('invoices', oldInvoice.id), { offerUsedBy: invoiceNo, offerUsedAt: ts(), updatedAt: ts() });
      if (oldPublicSnap?.exists()) tx.update(oldPublicSnap.ref, { offerUsed: true, updatedAt: ts() });
      stageAudit(tx, actor, { action: 'OFFER_USED', entityType: 'invoice', entityId: invoiceNo, branchId, newValue: { oldBill: oldInvoice.id, oldBillBranch: oldInvoice.branchId, percent: rules.offerPercent, discount: bill.discount } });
    }
    return { invoiceId: invoiceNo, qrToken: token, total: bill.total, discount: bill.discount };
  });
}

/**
 * Cancelling never deletes the bill. Pieces go back to stock; if this bill used an old
 * bill's offer, that old bill becomes valid again. A bill whose own offer was already
 * used cannot be cancelled until that later bill is cancelled.
 */
export async function cancelInvoice(actor, invoiceId, reason) {
  assertCan(actor, P.CANCEL_INVOICE);
  const why = requireReason(reason, 'A reason for cancelling');
  return runTransaction(db, async (tx) => {
    const invSnap = await tx.get(ref('invoices', invoiceId));
    const inv = requireDoc(invSnap, 'Bill');
    if (inv.status !== 'ACTIVE') throw new AppError('INVALID_STATE', 'This bill is already cancelled.');
    if (inv.offerUsedBy) throw new AppError('INVALID_STATE', `Its 50% offer was already used in bill ${inv.offerUsedBy}. Cancel that bill first.`);

    const [custSnap, pubSnap, ...prodSnaps] = await Promise.all([
      tx.get(ref('customers', inv.customerId)),
      tx.get(ref('publicInvoices', inv.qrToken)),
      ...inv.items.map((i) => tx.get(ref('products', i.productId))),
    ]);
    let oldSnap = null;
    let oldPublicSnap = null;
    if (inv.offer) {
      oldSnap = await tx.get(ref('invoices', inv.offer.oldInvoiceId));
      if (oldSnap.exists() && oldSnap.data().qrToken) oldPublicSnap = await tx.get(ref('publicInvoices', oldSnap.data().qrToken));
    }
    prodSnaps.forEach((s) => {
      const p = requireDoc(s, 'Product');
      if (p.status !== 'SOLD' || p.soldInvoiceId !== inv.id) throw new AppError('INVALID_STATE', `${p.name} (${p.id}) is no longer in a sold state, so this bill cannot be cancelled.`);
    });

    tx.update(invSnap.ref, { status: 'CANCELLED', cancelledAt: ts(), cancelledBy: actor.uid, cancelledByName: actor.name, cancelReason: why, updatedAt: ts() });
    if (pubSnap.exists()) tx.update(pubSnap.ref, { status: 'CANCELLED', updatedAt: ts() });
    prodSnaps.forEach((s) => {
      tx.update(s.ref, { status: 'AVAILABLE', soldInvoiceId: null, soldBranchId: null, soldToCustomerId: null, soldAt: null, updatedAt: ts() });
      stageMovement(tx, actor, { productId: s.id, type: 'SALE_CANCEL', toBranchId: inv.branchId, statusFrom: 'SOLD', statusTo: 'AVAILABLE', refType: 'invoice', refId: inv.id, reason: why });
    });
    if (oldSnap?.exists() && oldSnap.data().offerUsedBy === inv.id) {
      tx.update(oldSnap.ref, { offerUsedBy: null, offerUsedAt: null, updatedAt: ts() });
      if (oldPublicSnap?.exists()) tx.update(oldPublicSnap.ref, { offerUsed: false, updatedAt: ts() });
    }
    if (custSnap.exists()) {
      const c = custSnap.data();
      tx.update(custSnap.ref, { totalSpent: r2(Math.max(0, (c.totalSpent || 0) - inv.total)), billCount: Math.max(0, (c.billCount || 0) - 1) });
    }
    stageAudit(tx, actor, { action: 'INVOICE_CANCELLED', entityType: 'invoice', entityId: inv.id, branchId: inv.branchId, reason: why, oldValue: { status: 'ACTIVE', total: inv.total, paid: inv.paidAmount }, newValue: { status: 'CANCELLED', offerRestored: inv.offer?.oldInvoiceId || null } });
    return true;
  });
}

// ---------------------------------------------------------------- old bill lookup (read-only)

const looksLikeToken = (s) => /^[0-9a-f]{40,}$/i.test(s);

/** Find a bill from its QR link/token, its bill number, or a Product ID printed on it. */
export async function lookupOldBill(input) {
  let text = String(input || '').trim();
  if (!text) throw new AppError('NOT_FOUND', OFFER_MSG.NOT_FOUND);
  const m = text.match(/\/verify\/([0-9a-f]+)/i);
  if (m) text = m[1];
  let invoiceId = null;
  if (looksLikeToken(text)) {
    const pub = await getDoc(ref('publicInvoices', text.toLowerCase()));
    if (pub.exists()) invoiceId = pub.data().invoiceId;
  } else if (/^JWL-\d+$/i.test(text)) {
    const p = await getDoc(ref('products', text.toUpperCase()));
    if (p.exists()) invoiceId = p.data().soldInvoiceId;
  } else {
    invoiceId = text.toUpperCase();
  }
  if (!invoiceId) throw new AppError('NOT_FOUND', OFFER_MSG.NOT_FOUND);
  const inv = await getDoc(ref('invoices', invoiceId));
  if (!inv.exists()) throw new AppError('NOT_FOUND', OFFER_MSG.NOT_FOUND);
  return { id: inv.id, ...inv.data() };
}
