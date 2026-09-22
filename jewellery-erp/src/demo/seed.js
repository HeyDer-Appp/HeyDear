// Builds a small demo shop through the REAL service layer (the same transactions the
// live app runs), so the demo exercises exactly the production code paths.
import { __seed } from './fakeFirestore';
import { registerDemoAccount } from './fakeAuth';
import { DEFAULT_RULES } from '../lib/constants';
import { addProducts } from '../services/stock';
import { createCustomer } from '../services/customers';
import { completeSale } from '../services/sales';

export const DEMO_USERS = [
  { uid: 'demo-owner', email: 'owner@demo.com', name: 'Aarav Sharma', role: 'owner', branchId: null },
  { uid: 'demo-staff', email: 'staff@demo.com', name: 'Rahul Verma', role: 'staff', branchId: 'ngp01' },
  { uid: 'demo-staff2', email: 'staff2@demo.com', name: 'Sneha Patil', role: 'staff', branchId: 'wrd01' },
];

const piece = (name, category, purity, net, price, extra = {}) => ({ name, category, metal: 'Gold', purity, grossWeight: +(net + 0.3).toFixed(2), netWeight: net, price, ...extra });

export async function seedDemo() {
  __seed('meta/setup', { doneAt: Date.now() });
  __seed('settings/company', { name: 'Aurum Jewellers', address: '12 Sitabuldi Main Road, Nagpur', gstin: '', phone: '0712-2345678', invoiceFooter: 'Thank you! Bring this bill back to get 50% off your next purchase (one time only).' });
  __seed('settings/rules', { ...DEFAULT_RULES });
  __seed('branches/ngp01', { name: 'Nagpur Main', code: 'NGP01', address: 'Sitabuldi, Nagpur', phone: '0712-2345678', active: true });
  __seed('branches/wrd01', { name: 'Wardha', code: 'WRD01', address: 'Main Road, Wardha', phone: '07152-234567', active: true });
  DEMO_USERS.forEach((u) => {
    __seed(`users/${u.uid}`, { name: u.name, email: u.email, role: u.role, branchId: u.branchId, active: true });
    registerDemoAccount(u.email, u.uid);
  });
  const [owner, staff, staff2] = DEMO_USERS.map((u) => ({ ...u, active: true }));

  // The owner adds all stock, like in real life.
  const main = await addProducts(owner, { branchId: 'ngp01', items: [
    piece('Solitaire ring', 'Ring', '18K', 4.2, 38500, { huid: 'HU12AB' }), piece('Rope chain 20 inch', 'Chain', '22K', 12.5, 84200),
    piece('Temple necklace', 'Necklace', '22K', 32.8, 226000), piece('Jhumka earrings', 'Earrings', '22K', 8.6, 59800),
    piece('Kada bracelet', 'Bracelet', '22K', 18.4, 127500), piece('Plain band ring', 'Ring', '22K', 3.1, 21900),
    piece('Mangalsutra classic', 'Mangalsutra', '22K', 14.2, 98800), piece('Stud earrings', 'Earrings', '18K', 2.4, 17400),
    { ...piece('Gold coin 5g', 'Coin', '24K', 5, 38100), qty: 3 },
  ] });
  const wardha = await addProducts(owner, { branchId: 'wrd01', items: [
    piece('Rope chain 22 inch', 'Chain', '22K', 15, 102000), piece('Gents ring', 'Ring', '22K', 7.5, 53200), piece('Ladies ring', 'Ring', '22K', 4.8, 33900),
    piece('Baby bracelet', 'Bracelet', '22K', 5.4, 38700), { ...piece('Nose pin', 'Other', '22K', 1.2, 9800), qty: 4 },
  ] });

  const ravi = await createCustomer(staff, { name: 'Ravi Kulkarni', mobile: '9822012345', address: 'Ramdaspeth, Nagpur' });
  const priya = await createCustomer(staff, { name: 'Priya Deshmukh', mobile: '9890098900' });
  await createCustomer(staff, { name: 'Anil Bhandari', mobile: '9765043210' });

  const [solitaire, chain, , , , band] = main;
  // Bill 1 and bill 2 are ordinary bills. Each can give ONE 50% offer.
  await completeSale(staff, { branchId: 'ngp01', customerId: ravi, productIds: [solitaire], offer: null, payments: [{ mode: 'UPI', amount: 38500, ref: 'UPI2609' }] });
  await completeSale(staff, { branchId: 'ngp01', customerId: priya, productIds: [chain, band], offer: null, payments: [{ mode: 'CASH', amount: 50000 }, { mode: 'CARD', amount: 56100 }] });
  // Ravi used bill 1 at the OTHER branch (Wardha) for 50% off a new ring -> bill 1 is now expired.
  await completeSale(staff2, { branchId: 'wrd01', customerId: ravi, productIds: [wardha[2]], offer: { oldInvoiceId: 'NGP01-INV-000001' }, payments: [{ mode: 'UPI', amount: 16950 }] });
}
