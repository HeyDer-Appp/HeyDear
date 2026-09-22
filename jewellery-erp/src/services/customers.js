import { getDoc, getDocs, collection, query, where, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppError } from '../lib/errors';
import { P, assertCan } from '../lib/permissions';
import { normMobile } from '../lib/format';
import { clean, newRef, ref, ts } from './common';

const str = (v) => String(v || '').trim();

export async function createCustomer(actor, data) {
  assertCan(actor, P.MANAGE_CUSTOMERS);
  const mobile = normMobile(data.mobile);
  if (mobile.length !== 10) throw new AppError('VALIDATION', 'Enter a valid 10-digit mobile number.');
  const name = str(data.name);
  if (!name) throw new AppError('VALIDATION', 'Customer name is required.');
  const custRef = newRef('customers');
  return runTransaction(db, async (tx) => {
    const idx = await tx.get(ref('customerMobiles', mobile));
    if (idx.exists()) throw new AppError('DUPLICATE', 'A customer with this mobile number already exists.');
    tx.set(ref('customerMobiles', mobile), { customerId: custRef.id });
    tx.set(custRef, clean({ name, nameLower: name.toLowerCase(), mobile, address: str(data.address), totalSpent: 0, billCount: 0, lastPurchaseAt: null, createdBy: actor.uid, createdAt: ts() }));
    return custRef.id;
  });
}

// The mobile number is the lookup key, so it cannot be edited.
export async function updateCustomer(actor, id, patch) {
  assertCan(actor, P.MANAGE_CUSTOMERS);
  const next = {};
  if (patch.name !== undefined) {
    next.name = str(patch.name);
    if (!next.name) throw new AppError('VALIDATION', 'Customer name is required.');
    next.nameLower = next.name.toLowerCase();
  }
  if (patch.address !== undefined) next.address = str(patch.address);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref('customers', id));
    if (!snap.exists()) throw new AppError('NOT_FOUND', 'Customer not found.');
    tx.update(snap.ref, clean({ ...next, updatedAt: ts() }));
    return true;
  });
}

export async function getCustomer(id) {
  const s = await getDoc(ref('customers', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function findCustomerByMobile(mobileInput) {
  const mobile = normMobile(mobileInput);
  if (mobile.length !== 10) return null;
  const idx = await getDoc(ref('customerMobiles', mobile));
  return idx.exists() ? getCustomer(idx.data().customerId) : null;
}

export async function searchCustomers(text) {
  const t = str(text).toLowerCase();
  if (!t) return [];
  const digits = t.replace(/\D/g, '');
  const q = digits.length >= 3 && digits.length === t.length
    ? query(collection(db, 'customers'), where('mobile', '>=', digits), where('mobile', '<=', `${digits}`), limit(8))
    : query(collection(db, 'customers'), where('nameLower', '>=', t), where('nameLower', '<=', `${t}`), limit(8));
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listCustomers(max = 300) {
  const snap = await getDocs(query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function customerInvoices(customerId) {
  const snap = await getDocs(query(collection(db, 'invoices'), where('customerId', '==', customerId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
