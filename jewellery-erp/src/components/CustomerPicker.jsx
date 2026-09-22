import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { P } from '../lib/permissions';
import { normMobile } from '../lib/format';
import { createCustomer, findCustomerByMobile, getCustomer, searchCustomers } from '../services/customers';
import { Button, Field, Modal } from './ui';

export function CustomerForm({ initial = {}, onSaved, onCancel }) {
  const { actor } = useApp();
  const toast = useToast();
  const [f, setF] = useState({ name: '', mobile: '', address: '', ...initial });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      onSaved(await getCustomer(await createCustomer(actor, f)));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New customer" onClose={onCancel} footer={<><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save customer</Button></>}>
      <div className="stack">
        <Field label="Mobile number"><input autoFocus value={f.mobile} onChange={set('mobile')} inputMode="numeric" maxLength={14} /></Field>
        <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Address (optional)"><textarea value={f.address} onChange={set('address')} rows={2} /></Field>
      </div>
    </Modal>
  );
}

// Mobile-number first lookup, with add-on-miss.
export default function CustomerPicker({ value, onChange }) {
  const { can } = useApp();
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = text.trim();
    if (t.length < 3) { setResults([]); setSearched(false); return undefined; }
    let live = true;
    const h = setTimeout(async () => {
      try {
        const exact = normMobile(t).length === 10 ? await findCustomerByMobile(t) : null;
        const list = exact ? [exact] : await searchCustomers(t);
        if (live) { setResults(list); setSearched(true); }
      } catch { if (live) setResults([]); }
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [text]);

  if (value) {
    return (
      <div className="row between" style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: '#fbf9f4' }}>
        <div>
          <div className="bold">{value.name}</div>
          <div className="small muted">{value.mobile}</div>
        </div>
        <button className="icon-btn" onClick={() => onChange(null)} aria-label="Change customer"><X size={18} /></button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="row">
        <input placeholder="Search by mobile number or name…" value={text} onChange={(e) => setText(e.target.value)} />
        {can(P.MANAGE_CUSTOMERS) && <Button variant="ghost" onClick={() => setCreating(true)}><UserPlus size={16} /> New</Button>}
      </div>
      {(results.length > 0 || searched) && (
        <div className="suggest">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onChange(c); setText(''); setResults([]); }}>
              <span><b>{c.name}</b></span><span className="muted">{c.mobile}</span>
            </button>
          ))}
          {searched && !results.length && <div style={{ padding: 14 }} className="muted small">No customer found. Use "New" to add them.</div>}
        </div>
      )}
      {creating && (
        <CustomerForm
          initial={{ mobile: /^\d+$/.test(text) ? text : '', name: /^\d+$/.test(text) ? '' : text }}
          onCancel={() => setCreating(false)}
          onSaved={(c) => { setCreating(false); onChange(c); setText(''); }}
        />
      )}
    </div>
  );
}
