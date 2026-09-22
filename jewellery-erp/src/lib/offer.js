import { fmtDate } from './format';

export const OFFER_MSG = {
  NOT_FOUND: 'Bill could not be verified. Check the bill number / QR.',
  CANCELLED: 'This bill is cancelled, so it has no offer.',
  ALREADY_USED: 'This bill has already been used for the 50% offer - it has expired.',
  IS_OFFER_BILL: 'This bill was bought using the 50% offer, so it cannot give another one.',
};

// Returns null when the old bill can be used, otherwise { code, message }.
export function checkOldBill(invoice, percent = 50) {
  if (!invoice) return { code: 'NOT_FOUND', message: OFFER_MSG.NOT_FOUND };
  if (invoice.status !== 'ACTIVE') return { code: 'CANCELLED', message: OFFER_MSG.CANCELLED };
  if (invoice.offerUsedBy) {
    const when = invoice.offerUsedAt ? ` on ${fmtDate(invoice.offerUsedAt)}` : '';
    return { code: 'ALREADY_USED', message: `${OFFER_MSG.ALREADY_USED} (used${when} in bill ${invoice.offerUsedBy})` };
  }
  if (invoice.offer) return { code: 'IS_OFFER_BILL', message: OFFER_MSG.IS_OFFER_BILL.replace('50%', `${percent}%`) };
  return null;
}
