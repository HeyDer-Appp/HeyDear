import { Plus, Trash2 } from 'lucide-react';
import { PAYMENT_MODES } from '../lib/constants';
import { inr, r2 } from '../lib/money';

const MODE_LABEL = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', BANK: 'Bank transfer' };

// Cash / UPI / Card / Bank, or several rows for a mixed payment.
export default function PaymentEditor({ payments, onChange, total, allowShort = false }) {
  const paid = r2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const diff = r2(total - paid);
  const upd = (i, patch) => onChange(payments.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...payments, { mode: 'UPI', amount: diff > 0 ? diff : '', ref: '' }]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      {payments.map((p, i) => (
        <div className="row" key={i}>
          <select value={p.mode} onChange={(e) => upd(i, { mode: e.target.value })} style={{ width: 130 }}>
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
          <input type="number" min="0" step="0.01" placeholder="Amount" value={p.amount} onChange={(e) => upd(i, { amount: e.target.value })} />
          {p.mode !== 'CASH' && <input placeholder="Ref / UTR" value={p.ref || ''} onChange={(e) => upd(i, { ref: e.target.value })} />}
          {payments.length > 1 && <button className="icon-btn" onClick={() => onChange(payments.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={16} /></button>}
        </div>
      ))}
      <div className="row between">
        <button className="btn ghost sm" onClick={add}><Plus size={14} /> Split payment</button>
        <span className="small" style={{ color: diff === 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--amber)' }}>
          {diff === 0 ? 'Fully paid' : diff < 0 ? `Over by ${inr(-diff)}` : allowShort ? `On credit: ${inr(diff)}` : `Short by ${inr(diff)}`}
        </span>
      </div>
    </div>
  );
}
