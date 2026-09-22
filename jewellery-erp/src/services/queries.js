import { getDoc, getDocs, collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { tsMs } from '../lib/format';
import { ref } from './common';

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const newestFirst = (a, b) => tsMs(b.createdAt) - tsMs(a.createdAt);

export async function listInvoices({ branchId, from, to, max = 1000 } = {}) {
  const c = [];
  if (branchId) c.push(where('branchId', '==', branchId));
  if (from) c.push(where('createdAt', '>=', Timestamp.fromDate(from)));
  if (to) c.push(where('createdAt', '<=', Timestamp.fromDate(to)));
  c.push(limit(max));
  return rows(await getDocs(query(collection(db, 'invoices'), ...c))).sort(newestFirst);
}

export async function getInvoice(id) {
  const s = await getDoc(ref('invoices', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function listProducts({ branchId, status, max = 5000 } = {}) {
  const c = [];
  if (branchId) c.push(where('branchId', '==', branchId));
  if (status) c.push(where('status', '==', status));
  c.push(limit(max));
  return rows(await getDocs(query(collection(db, 'products'), ...c))).sort((a, b) => b.id.localeCompare(a.id));
}

export async function getProduct(id) {
  const s = await getDoc(ref('products', String(id || '').trim().toUpperCase()));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function productMovements(productId) {
  return rows(await getDocs(query(collection(db, 'movements'), where('productId', '==', productId)))).sort(newestFirst);
}

export async function listAudit(max = 300) {
  return rows(await getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(max))));
}

export async function getPublicInvoice(token) {
  const s = await getDoc(ref('publicInvoices', String(token || '').toLowerCase()));
  return s.exists() ? s.data() : null;
}
