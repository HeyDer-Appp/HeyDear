import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/firestore', async () => import('../src/demo/fakeFirestore.js'));
vi.mock('../src/lib/firebase.js', () => ({ db: {}, auth: {}, firebaseConfig: {} }));

import { __get, __list, __seed, hooks } from '../src/demo/fakeFirestore.js';
import { calcBill } from '../src/lib/calc.js';
import { parseStockCsv } from '../src/lib/csv.js';
import { cancelInvoice, completeSale, lookupOldBill } from '../src/services/sales.js';
import { addProducts, distributeProducts, removeProduct, updateProduct } from '../src/services/stock.js';
import { createCustomer } from '../src/services/customers.js';
import { cash, customer, item, owner, resetWorld, sell, staffA, staffC, stock } from './helpers.js';

const fail = async (p) => { try { await p; } catch (e) { return e; } throw new Error('expected the promise to reject'); };
const branches = [{ id: 'a', code: 'NGA01' }, { id: 'c', code: 'NGC01' }];

beforeEach(() => resetWorld());

// a sold bill that has not been used for an offer yet
async function oldBill(price = 1000, branch = 'a', mobile = '9876543210') {
  const [p] = await stock(branch, [price]);
  const cid = await customer(mobile);
  const r = await sell(staffA, branch, cid, [p], { payments: cash(price) });
  return { ...r, p, cid };
}
// bill for a new purchase using an old bill's offer
const useOffer = (actor, branchId, cid, productIds, oldId, total) =>
  sell(actor, branchId, cid, productIds, { offer: { oldInvoiceId: oldId }, payments: cash(total) });

describe('bill maths', () => {
  it('50% off the whole purchase, then GST on what is left', () => {
    expect(calcBill({ subtotal: 1000, offerPercent: 50 })).toMatchObject({ discount: 500, total: 500 });
    const b = calcBill({ subtotal: 1000, offerPercent: 50, gstPercent: 3 });
    expect(b).toMatchObject({ discount: 500, taxable: 500, tax: 15, total: 515 });
    expect(calcBill({ subtotal: 999.99, offerPercent: 50 }).discount).toBe(500);
  });

  it('with an old-bill offer, discount is 50% of whichever is cheaper - the old bill or the new purchase', () => {
    // old bill 50, new purchase 100 -> 50% of the cheaper one (50) = 25
    expect(calcBill({ subtotal: 100, offerPercent: 50, oldBillAmount: 50 })).toMatchObject({ discount: 25, total: 75 });
    // old bill 1000, new purchase 400 -> 50% of the cheaper one (400) = 200
    expect(calcBill({ subtotal: 400, offerPercent: 50, oldBillAmount: 1000 })).toMatchObject({ discount: 200, total: 200 });
  });
});

describe('owner adds inventory', () => {
  it('creates permanent Product IDs, expands qty, records history', async () => {
    const ids = await addProducts(owner, { branchId: 'a', items: [item('Ring', 100), { ...item('Chain', 200), qty: 3 }] });
    expect(ids).toEqual(['JWL-000001', 'JWL-000002', 'JWL-000003', 'JWL-000004']);
    expect(__get('products/JWL-000002')).toMatchObject({ name: 'Chain', price: 200, branchId: 'a', status: 'AVAILABLE' });
    expect(__list('movements').filter((m) => m.type === 'ADDED')).toHaveLength(4);
    expect(await addProducts(owner, { branchId: 'c', items: [item('Ear', 50)] })).toEqual(['JWL-000005']);
    expect(__list('auditLogs').some((a) => a.action === 'STOCK_ADDED')).toBe(true);
  });

  it('only the owner can add / distribute / remove; bad rows are rejected', async () => {
    expect((await fail(addProducts(staffA, { branchId: 'a', items: [item('x', 10)] }))).code).toBe('FORBIDDEN');
    expect((await fail(addProducts(owner, { branchId: 'a', items: [item('x', 0)] }))).code).toBe('VALIDATION');
    expect((await fail(addProducts(owner, { branchId: 'a', items: [item('x', 10, { grossWeight: 2, netWeight: 3 })] }))).code).toBe('VALIDATION');
    expect((await fail(addProducts(owner, { branchId: 'zz', items: [item('x', 10)] }))).code).toBe('NOT_FOUND');
    expect(__list('products')).toHaveLength(0);
  });

  it('handles the biggest allowed batch in one transaction', async () => {
    const ids = await addProducts(owner, { branchId: 'a', items: [{ ...item('Bulk', 10), qty: 200 }] });
    expect(ids).toHaveLength(200);
    expect((await fail(addProducts(owner, { branchId: 'a', items: [{ ...item('Bulk', 10), qty: 201 }] }))).code).toBe('VALIDATION');
  });

  it('edit price needs a reason and is audited; unsold only', async () => {
    const [p] = await stock('a', [100]);
    expect((await fail(updateProduct(owner, p, { price: 120 }, ''))).code).toBe('VALIDATION');
    await updateProduct(owner, p, { price: 120 }, 'rate change');
    expect(__get(`products/${p}`).price).toBe(120);
    expect(__list('auditLogs').find((a) => a.action === 'PRICE_CHANGED').newValue).toEqual({ price: 120 });
    await removeProduct(owner, p, 'typo');
    expect(__get(`products/${p}`).status).toBe('REMOVED');
    expect((await fail(updateProduct(owner, p, { price: 5 }))).code).toBe('INVALID_STATE');
  });
});

describe('CSV upload parsing', () => {
  const csv = 'Name,Category,Metal,Purity,Gross Weight,Net Weight,Price,HUID,Branch,Qty\n'
    + 'Solitaire ring,Ring,Gold,18K,4.5,4.2,"38,500",HU1,NGA01,2\n'
    + '"Chain, 20 inch",Chain,Gold,22K,12.8,12.5,84200,,ngc01,\n'
    + 'Broken,,,,,,abc,,,\n'
    + 'Nowhere,Ring,Gold,22K,1,1,500,,XX99,1\n';

  it('maps headers, quotes, branch codes, quantity and flags bad rows', () => {
    const r = parseStockCsv(csv, branches, 'a');
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0]).toMatchObject({ branchId: 'a', qty: 2, error: '', item: { name: 'Solitaire ring', price: 38500, purity: '18K', netWeight: 4.2, huid: 'HU1' } });
    expect(r.rows[1]).toMatchObject({ branchId: 'c', qty: 1, error: '', item: { name: 'Chain, 20 inch', price: 84200 } });
    expect(r.rows[2].error).toMatch(/Price/);
    expect(r.rows[3].error).toMatch(/Unknown branch/);
  });

  it('accepts a paste straight from Excel (tab separated) and uses the default branch', () => {
    const r = parseStockCsv('item\tprice\tweight\nBangle\t1,20,000\t20\nRing\t500\t3', branches, 'c');
    expect(r.rows.map((x) => [x.item.name, x.item.price, x.item.netWeight, x.branchId, x.error])).toEqual([['Bangle', 120000, 20, 'c', ''], ['Ring', 500, 3, 'c', '']]);
  });

  it('asks for the essential columns', () => {
    expect(parseStockCsv('foo,bar\n1,2', branches, 'a').errors[0]).toMatch(/name.*price/);
    expect(parseStockCsv('', branches, 'a').errors).toHaveLength(1);
  });

  it('a parsed file imports through addProducts', async () => {
    const r = parseStockCsv(csv, branches, 'a').rows.filter((x) => !x.error);
    for (const row of r) await addProducts(owner, { branchId: row.branchId, items: [{ ...row.item, qty: row.qty }] });
    expect(__list('products')).toHaveLength(3);
    expect(__list('products').filter((p) => p.branchId === 'c')).toHaveLength(1);
  });
});

describe('owner distributes inventory to branches', () => {
  it('moves pieces immediately and keeps history', async () => {
    const [p1, p2] = await stock('a', [100, 200]);
    expect(await distributeProducts(owner, { productIds: [p1, p2], toBranchId: 'c' })).toBe(2);
    expect(__get(`products/${p1}`).branchId).toBe('c');
    expect(__list('movements').filter((m) => m.type === 'DISTRIBUTED')).toHaveLength(2);
    expect(__list('auditLogs').some((a) => a.action === 'STOCK_DISTRIBUTED')).toBe(true);
  });

  it('refuses staff, sold pieces, same-branch moves - and moves nothing on failure', async () => {
    const [p1, p2] = await stock('a', [100, 200]);
    expect((await fail(distributeProducts(staffA, { productIds: [p1], toBranchId: 'c' }))).code).toBe('FORBIDDEN');
    await sell(staffA, 'a', await customer(), [p2], { payments: cash(200) });
    expect((await fail(distributeProducts(owner, { productIds: [p1, p2], toBranchId: 'c' }))).code).toBe('UNAVAILABLE');
    expect(__get(`products/${p1}`).branchId).toBe('a');
    expect((await fail(distributeProducts(owner, { productIds: [p1], toBranchId: 'a' }))).code).toBe('VALIDATION');
  });
});

describe('billing', () => {
  it('sells pieces, updates stock, history and customer totals', async () => {
    const [p1] = await stock('a', [1000]);
    const cid = await customer();
    const r = await sell(staffA, 'a', cid, [p1], { payments: cash(1000) });
    expect(r.invoiceId).toBe('NGA01-INV-000001');
    expect(__get(`invoices/${r.invoiceId}`)).toMatchObject({ total: 1000, paidAmount: 1000, status: 'ACTIVE', offer: null, offerUsedBy: null });
    expect(__get(`products/${p1}`)).toMatchObject({ status: 'SOLD', soldInvoiceId: r.invoiceId });
    expect(__get(`customers/${cid}`)).toMatchObject({ billCount: 1, totalSpent: 1000 });
    expect(typeof __get(`invoices/${r.invoiceId}`).createdAt.toMillis()).toBe('number');
    expect(__list('movements').some((m) => m.type === 'SALE' && m.productId === p1)).toBe(true);
  });

  it('blocks sold and other-branch pieces, part payment and overpayment', async () => {
    const [p1, p2] = await stock('a', [100, 100]);
    const [c1] = await stock('c', [100]);
    const cid = await customer();
    await sell(staffA, 'a', cid, [p1], { payments: cash(100) });
    expect((await fail(sell(staffA, 'a', cid, [p1], { payments: cash(100) }))).code).toBe('UNAVAILABLE');
    expect((await fail(sell(staffA, 'a', cid, [c1], { payments: cash(100) }))).message).toMatch(/not in stock at this branch/);
    expect((await fail(sell(staffA, 'a', cid, [p2], { payments: cash(50) }))).message).toMatch(/short/);
    expect((await fail(sell(staffA, 'a', cid, [p2], { payments: cash(150) }))).message).toMatch(/more than/);
    expect((await fail(sell(staffC, 'a', cid, [p2], { payments: cash(100) }))).code).toBe('FORBIDDEN');
  });

  it('mixed payment 150 = 50 cash + 100 UPI; GST from settings', async () => {
    __seed('settings/rules', { offerPercent: 50, gstPercent: 3 });
    const [p1] = await stock('a', [1000]);
    await sell(staffA, 'a', await customer(), [p1], { payments: [{ mode: 'CASH', amount: 30 }, { mode: 'UPI', amount: 1000, ref: 'U1' }] });
    expect(__list('invoices')[0]).toMatchObject({ tax: 30, total: 1030, paidAmount: 1030 });
  });

  it('QR record shows nothing private', async () => {
    const b = await oldBill();
    const pub = __get(`publicInvoices/${b.qrToken}`);
    expect(b.qrToken).toMatch(/^[0-9a-f]{48}$/);
    expect(JSON.stringify(pub)).not.toMatch(/mobile|phone|address|cost|profit|notes|createdBy/i);
    expect(pub).toMatchObject({ total: 1000, canGiveOffer: true, offerUsed: false });
  });

  it('duplicate mobile numbers are refused', async () => {
    await customer('9876543210');
    expect((await fail(createCustomer(staffA, { name: 'X', mobile: '98765 43210' }))).code).toBe('DUPLICATE');
  });
});

describe('old bill -> 50% off next purchase (one time, any branch)', () => {
  it('scan an unused old bill: 50% off, and that old bill expires', async () => {
    const old = await oldBill(1000, 'a');
    const [np] = await stock('a', [400]);
    const r = await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 200);
    expect(r).toMatchObject({ total: 200, discount: 200 });
    expect(__get(`invoices/${r.invoiceId}`)).toMatchObject({ discount: 200, offer: { type: 'OLD_BILL', oldInvoiceId: old.invoiceId, percent: 50, amount: 200 } });
    const used = __get(`invoices/${old.invoiceId}`);
    expect(used.offerUsedBy).toBe(r.invoiceId);
    expect(typeof used.offerUsedAt.toMillis()).toBe('number');
    expect(__get(`publicInvoices/${old.qrToken}`).offerUsed).toBe(true);
    expect(__list('auditLogs').some((a) => a.action === 'OFFER_USED')).toBe(true);
  });

  it('works at a different branch than the one that issued the old bill', async () => {
    const old = await oldBill(1000, 'a');
    const [np] = await stock('c', [600]);
    const r = await useOffer(staffC, 'c', old.cid, [np], old.invoiceId, 300);
    expect(r.invoiceId).toBe('NGC01-INV-000001');
    expect(__get(`invoices/${r.invoiceId}`).offer.oldBranchId).toBe('a');
  });

  it('second use of the same old bill is refused - it has expired', async () => {
    const old = await oldBill(1000);
    const [n1, n2] = await stock('a', [400, 400]);
    const first = await useOffer(staffA, 'a', old.cid, [n1], old.invoiceId, 200);
    const e = await fail(useOffer(staffA, 'a', old.cid, [n2], old.invoiceId, 200));
    expect(e.code).toBe('ALREADY_USED');
    expect(e.message).toContain(first.invoiceId);
    expect(__get(`products/${n2}`).status).toBe('AVAILABLE');
  });

  it('two counters racing on one old bill: exactly one wins', async () => {
    const old = await oldBill(1000);
    const [n1, n2] = await stock('a', [400, 400]);
    const results = await Promise.allSettled([
      useOffer(staffA, 'a', old.cid, [n1], old.invoiceId, 200),
      useOffer(owner, 'a', old.cid, [n2], old.invoiceId, 200),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(__list('invoices').filter((i) => i.offer)).toHaveLength(1);
  });

  it('refuses unknown, cancelled and already-discounted bills', async () => {
    const old = await oldBill(1000);
    const [n1, n2, n3] = await stock('a', [400, 400, 400]);
    expect((await fail(useOffer(staffA, 'a', old.cid, [n1], 'NOPE-1', 200))).code).toBe('NOT_FOUND');
    const offerBill = await useOffer(staffA, 'a', old.cid, [n1], old.invoiceId, 200);
    // the bill that itself got the offer cannot hand out another one
    expect((await fail(useOffer(staffA, 'a', old.cid, [n2], offerBill.invoiceId, 200))).code).toBe('IS_OFFER_BILL');
    const other = await sell(staffA, 'a', old.cid, [n3], { payments: cash(400) });
    await cancelInvoice(owner, other.invoiceId, 'wrong item');
    const [n4] = await stock('a', [400]);
    expect((await fail(useOffer(staffA, 'a', old.cid, [n4], other.invoiceId, 200))).code).toBe('CANCELLED');
  });

  it('new purchase pricier than the old bill: discount caps at 50% of the old bill, not the new purchase', async () => {
    const old = await oldBill(50, 'a');
    const [np] = await stock('a', [100]);
    const r = await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 75);
    expect(r).toMatchObject({ total: 75, discount: 25 });
  });

  it('percentage comes from settings', async () => {
    __seed('settings/rules', { offerPercent: 30, gstPercent: 0 });
    const old = await oldBill(1000);
    const [np] = await stock('a', [1000]);
    expect((await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 700)).discount).toBe(300);
  });

  it('the old bill can be found by QR link, QR token, bill number or a Product ID on it', async () => {
    const old = await oldBill(1000);
    for (const q of [`https://shop.example/verify/${old.qrToken}`, old.qrToken, old.invoiceId.toLowerCase(), old.p]) {
      expect((await lookupOldBill(q)).id).toBe(old.invoiceId);
    }
    expect((await fail(lookupOldBill('JWL-424242'))).code).toBe('NOT_FOUND');
    expect((await fail(lookupOldBill('nonsense'))).code).toBe('NOT_FOUND');
  });

  it('a payment that ignores the discount is refused', async () => {
    const old = await oldBill(1000);
    const [np] = await stock('a', [400]);
    expect((await fail(useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 400))).message).toMatch(/more than/);
    expect(__get(`invoices/${old.invoiceId}`).offerUsedBy).toBeNull();
  });
});

describe('cancelling a bill', () => {
  it('only the owner, with a reason; stock returns and it is audited', async () => {
    const [p] = await stock('a', [500]);
    const cid = await customer();
    const r = await sell(staffA, 'a', cid, [p], { payments: cash(500) });
    expect((await fail(cancelInvoice(staffA, r.invoiceId, 'oops'))).code).toBe('FORBIDDEN');
    expect((await fail(cancelInvoice(owner, r.invoiceId, ''))).code).toBe('VALIDATION');
    await cancelInvoice(owner, r.invoiceId, 'billing mistake');
    expect(__get(`invoices/${r.invoiceId}`)).toMatchObject({ status: 'CANCELLED', cancelReason: 'billing mistake' });
    expect(__get(`products/${p}`).status).toBe('AVAILABLE');
    expect(__get(`customers/${cid}`)).toMatchObject({ billCount: 0, totalSpent: 0 });
    expect(__get(`publicInvoices/${r.qrToken}`).status).toBe('CANCELLED');
    expect(__list('auditLogs').some((a) => a.action === 'INVOICE_CANCELLED' && a.reason === 'billing mistake')).toBe(true);
    expect((await fail(cancelInvoice(owner, r.invoiceId, 'again please'))).code).toBe('INVALID_STATE');
  });

  it('cancelling an offer bill makes the old bill valid again', async () => {
    const old = await oldBill(1000);
    const [np, np2] = await stock('a', [400, 400]);
    const r = await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 200);
    await cancelInvoice(owner, r.invoiceId, 'customer left');
    expect(__get(`invoices/${old.invoiceId}`).offerUsedBy).toBeNull();
    expect(__get(`publicInvoices/${old.qrToken}`).offerUsed).toBe(false);
    expect((await useOffer(staffA, 'a', old.cid, [np2], old.invoiceId, 200)).discount).toBe(200);
  });

  it('a bill whose offer was already used cannot be cancelled first', async () => {
    const old = await oldBill(1000);
    const [np] = await stock('a', [400]);
    await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 200);
    expect((await fail(cancelInvoice(owner, old.invoiceId, 'mistake'))).message).toMatch(/Cancel that bill first/);
  });
});

describe('atomicity', () => {
  it('a failure part-way writes nothing, and the same bill works once the fault is gone', async () => {
    const old = await oldBill(1000);
    const [np] = await stock('a', [400]);
    const before = { movements: __list('movements').length, invoices: __list('invoices').length };
    hooks.failOnPath = `invoices/${old.invoiceId}`; // the last write of an offer bill
    await fail(useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 200));
    hooks.failOnPath = null;
    expect(__get(`products/${np}`).status).toBe('AVAILABLE');
    expect(__list('invoices')).toHaveLength(before.invoices);
    expect(__list('movements')).toHaveLength(before.movements);
    expect(__get(`invoices/${old.invoiceId}`).offerUsedBy).toBeNull();
    expect((await useOffer(staffA, 'a', old.cid, [np], old.invoiceId, 200)).total).toBe(200);
  });
});
