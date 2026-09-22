import { useState } from 'react';
import { useApp } from '../context/Auth';
import { endOfDay, startOfDay, toInputDate } from '../lib/format';

// Owner and accountant can look across all branches; everybody else is pinned to their own.
export function useBranchScope() {
  const { isOwner, profile, branches } = useApp();
  const wide = isOwner;
  const [sel, setSel] = useState('');
  const branchId = wide ? sel : profile.branchId || '';
  const control = wide ? (
    <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: 'auto' }} aria-label="Branch filter">
      <option value="">All branches</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  ) : null;
  return { branchId, control, wide };
}

export function useDateRange(defaultDays = 30) {
  const [from, setFrom] = useState(toInputDate(new Date(Date.now() - (defaultDays - 1) * 86400000)));
  const [to, setTo] = useState(toInputDate(new Date()));
  const range = { from: startOfDay(from ? new Date(`${from}T00:00:00`) : new Date()), to: endOfDay(to ? new Date(`${to}T00:00:00`) : new Date()) };
  const control = (
    <div className="row" style={{ gap: 6 }}>
      <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} aria-label="From" />
      <span className="muted">to</span>
      <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} aria-label="To" />
    </div>
  );
  return { ...range, key: `${from}|${to}`, control };
}
