import { r2 } from './money';

// The old-bill offer: `offerPercent`% off whichever is cheaper - the old bill's amount
// or this new purchase's subtotal. (Old bill 50, new purchase 100 -> discount is 50% of
// 50 = 25, not 50% of 100.) `oldBillAmount` is omitted/null when no offer is being used.
export function calcBill({ subtotal, offerPercent = 0, oldBillAmount = null, gstPercent = 0 }) {
  const sub = r2(subtotal);
  const percent = Number(offerPercent) || 0;
  const base = percent > 0 && oldBillAmount != null ? Math.min(sub, r2(oldBillAmount)) : sub;
  const discount = Math.min(r2((base * percent) / 100), sub);
  const taxable = r2(sub - discount);
  const tax = r2((taxable * (Number(gstPercent) || 0)) / 100);
  return { subtotal: sub, offerPercent: percent, discount, taxable, gstPercent: Number(gstPercent) || 0, tax, total: r2(taxable + tax) };
}
