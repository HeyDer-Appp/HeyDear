import { __reset, __seed } from '../src/demo/fakeFirestore.js';
import { addProducts } from '../src/services/stock.js';
import { createCustomer } from '../src/services/customers.js';
import { completeSale } from '../src/services/sales.js';

export const owner = { uid: 'u-owner', name: 'Owner', role: 'owner', active: true, branchId: null };
export const staffA = { uid: 'u-staffA', name: 'Staff A', role: 'staff', active: true, branchId: 'a' };
export const staffC = { uid: 'u-staffC', name: 'Staff C', role: 'staff', active: true, branchId: 'c' };

export const item = (name, price, extra = {}) => ({ name, category: 'Ring', metal: 'Gold', purity: '22K', grossWeight: 5, netWeight: 4.8, price, ...extra });

export function resetWorld(rules) {
  __reset();
  __seed('branches/a', { name: 'Nagpur Main', code: 'NGA01', active: true });
  __seed('branches/c', { name: 'Nagpur City', code: 'NGC01', active: true });
  if (rules) __seed('settings/rules', rules);
}

export const stock = (branchId, prices) => addProducts(owner, { branchId, items: prices.map((p, i) => item(`Item ${branchId}${i}`, p)) });
export const customer = (mobile = '9876543210') => createCustomer(staffA, { name: 'Ravi Kumar', mobile });
export const cash = (amount) => [{ mode: 'CASH', amount }];

export const sell = (actor, branchId, customerId, productIds, extra = {}) =>
  completeSale(actor, { branchId, customerId, productIds, offer: null, payments: [], ...extra });
