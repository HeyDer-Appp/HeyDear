import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getDoc, getDocs, collection, writeBatch, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../lib/firebase';
import { AppError } from '../lib/errors';
import { DEFAULT_COMPANY, DEFAULT_RULES } from '../lib/constants';
import { P, assertCan } from '../lib/permissions';
import { clean, ref, ts } from './common';

const str = (v) => String(v || '').trim();
const CODE_RE = /^[A-Z0-9]{2,8}$/;

// ------------------------------------------------------------------ first-run setup

export async function isSetupDone() {
  return (await getDoc(ref('meta', 'setup'))).exists();
}

/** One-time wizard: the single owner account, the company and the first branch. */
export async function runInitialSetup({ email, password, ownerName, company, branch }) {
  if (await isSetupDone()) throw new AppError('INVALID_STATE', 'Setup has already been completed.');
  const code = str(branch.code).toUpperCase();
  if (!CODE_RE.test(code)) throw new AppError('VALIDATION', 'Branch code must be 2-8 letters/digits (e.g. NGP01).');
  if (!str(company.name) || !str(branch.name) || !str(ownerName)) throw new AppError('VALIDATION', 'Fill in all required fields.');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: str(ownerName) });
  const uid = cred.user.uid;
  const batch = writeBatch(db);
  batch.set(ref('users', uid), { name: str(ownerName), email, role: 'owner', branchId: null, active: true, createdAt: ts() });
  batch.set(ref('settings', 'company'), { ...DEFAULT_COMPANY, ...clean(company) });
  batch.set(ref('settings', 'rules'), DEFAULT_RULES);
  batch.set(ref('branches', code.toLowerCase()), clean({ name: str(branch.name), code, address: str(branch.address), phone: str(branch.phone), active: true, createdAt: ts() }));
  batch.set(ref('meta', 'setup'), { doneAt: ts(), by: uid });
  await batch.commit();
  return uid;
}

// ------------------------------------------------------------------ settings

export async function loadConfig() {
  const [company, rules, branches] = await Promise.all([getDoc(ref('settings', 'company')), getDoc(ref('settings', 'rules')), getDocs(collection(db, 'branches'))]);
  return {
    company: { ...DEFAULT_COMPANY, ...(company.exists() ? company.data() : {}) },
    rules: { ...DEFAULT_RULES, ...(rules.exists() ? rules.data() : {}) },
    branches: branches.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export async function saveCompany(actor, data) {
  assertCan(actor, P.MANAGE_SETTINGS);
  if (!str(data.name)) throw new AppError('VALIDATION', 'Shop name is required.');
  await setDoc(ref('settings', 'company'), clean({ ...DEFAULT_COMPANY, ...data }));
}

export async function saveRules(actor, rules) {
  assertCan(actor, P.MANAGE_SETTINGS);
  const offerPercent = Number(rules.offerPercent);
  const gstPercent = Number(rules.gstPercent) || 0;
  if (!(offerPercent > 0 && offerPercent <= 100)) throw new AppError('VALIDATION', 'Offer percentage must be between 1 and 100.');
  if (gstPercent < 0 || gstPercent > 100) throw new AppError('VALIDATION', 'GST must be between 0 and 100.');
  const next = { offerPercent, gstPercent };
  const batch = writeBatch(db);
  batch.set(ref('settings', 'rules'), next);
  batch.set(ref('auditLogs', `rules-${Date.now()}`), { action: 'SETTINGS_CHANGED', entityType: 'settings', entityId: 'rules', newValue: next, userId: actor.uid, userName: actor.name, userRole: actor.role, createdAt: ts() });
  await batch.commit();
}

// ------------------------------------------------------------------ branches

export async function saveBranch(actor, id, data) {
  assertCan(actor, P.MANAGE_BRANCHES);
  const code = str(data.code).toUpperCase();
  if (!str(data.name)) throw new AppError('VALIDATION', 'Branch name is required.');
  const body = clean({ name: str(data.name), address: str(data.address), phone: str(data.phone), active: data.active !== false });
  if (id) {
    await updateDoc(ref('branches', id), body); // the code is part of every bill number, so it never changes
    return id;
  }
  if (!CODE_RE.test(code)) throw new AppError('VALIDATION', 'Branch code must be 2-8 letters/digits (e.g. NGP02).');
  const newId = code.toLowerCase();
  if ((await getDoc(ref('branches', newId))).exists()) throw new AppError('DUPLICATE', 'A branch with this code already exists.');
  await setDoc(ref('branches', newId), { ...body, code, createdAt: ts() });
  return newId;
}

// ------------------------------------------------------------------ staff

export async function listUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Creates the login through a throw-away second Firebase app so the owner stays signed
 * in, then writes the users/{uid} profile that the security rules check.
 */
export async function createStaff(actor, { name, email, password, branchId }) {
  assertCan(actor, P.MANAGE_STAFF);
  if (!str(name) || !str(email)) throw new AppError('VALIDATION', 'Name and email are required.');
  if (!branchId) throw new AppError('VALIDATION', 'Choose the branch this person works at.');
  if (String(password || '').length < 6) throw new AppError('VALIDATION', 'Password must be at least 6 characters.');
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    const sAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(sAuth, str(email), password);
    await updateProfile(cred.user, { displayName: str(name) });
    await signOut(sAuth);
    await setDoc(ref('users', cred.user.uid), { name: str(name), email: str(email).toLowerCase(), role: 'staff', branchId, active: true, createdAt: ts(), createdBy: actor.uid });
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}

export async function updateStaff(actor, uid, patch) {
  assertCan(actor, P.MANAGE_STAFF);
  const next = {};
  if (patch.name !== undefined) next.name = str(patch.name);
  if (patch.branchId !== undefined) next.branchId = patch.branchId;
  if (patch.active !== undefined) next.active = !!patch.active;
  await updateDoc(ref('users', uid), clean({ ...next, updatedAt: ts() }));
  await addDoc(collection(db, 'auditLogs'), { action: 'STAFF_CHANGED', entityType: 'user', entityId: uid, newValue: next, userId: actor.uid, userName: actor.name, userRole: actor.role, createdAt: ts() });
}

export const sendReset = (email) => sendPasswordResetEmail(auth, email);
