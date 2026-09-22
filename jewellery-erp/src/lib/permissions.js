import { AppError } from './errors';

export const P = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  VIEW_STOCK: 'VIEW_STOCK',
  MANAGE_STOCK: 'MANAGE_STOCK', // add / upload / distribute / remove / edit price
  CREATE_BILL: 'CREATE_BILL',
  VIEW_INVOICES: 'VIEW_INVOICES',
  CANCEL_INVOICE: 'CANCEL_INVOICE',
  VIEW_CUSTOMERS: 'VIEW_CUSTOMERS',
  MANAGE_CUSTOMERS: 'MANAGE_CUSTOMERS',
  MANAGE_BRANCHES: 'MANAGE_BRANCHES',
  MANAGE_STAFF: 'MANAGE_STAFF',
  MANAGE_SETTINGS: 'MANAGE_SETTINGS',
  VIEW_AUDIT: 'VIEW_AUDIT',
};

export const ROLE_PERMISSIONS = {
  owner: Object.values(P),
  staff: [P.VIEW_DASHBOARD, P.VIEW_STOCK, P.CREATE_BILL, P.VIEW_INVOICES, P.VIEW_CUSTOMERS, P.MANAGE_CUSTOMERS],
};

export function can(actor, perm) {
  return !!actor && actor.active !== false && (ROLE_PERMISSIONS[actor.role] || []).includes(perm);
}

export function assertCan(actor, perm, message) {
  if (!can(actor, perm)) throw new AppError('FORBIDDEN', message || 'You do not have permission to do this.');
}

// Staff may only act on their own branch; the owner may act anywhere.
export function assertBranch(actor, branchId) {
  if (actor.role !== 'owner' && actor.branchId !== branchId) {
    throw new AppError('FORBIDDEN', 'This is limited to your own branch.');
  }
}
