import { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { CATEGORIES, METALS, PURITIES } from '../lib/constants';
import { CSV_TEMPLATE, parseStockCsv } from '../lib/csv';
import { downloadCsv } from '../lib/format';
import { inr } from '../lib/money';
import { MAX_PIECES_PER_CALL, addProducts, distributeProducts } from '../services/stock';
import { Button, Field, Modal } from './ui';

const EMPTY = { name: '', category: 'Ring', metal: 'Gold', purity: '22K', grossWeight: '', netWeight: '', price: '', huid: '', qty: 1 };

// ------------------------------------------------------------------ add one product (or a few identical ones)
export function AddProductModal({ defaultBranchId, onClose, onCreated }) {
  const { actor, branches } = useApp();
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setError('');
    try {
      const ids = await addProducts(actor, { branchId, items: [f], note: 'Added manually' });
      toast.success(ids.length === 1 ? `Created ${ids[0]}` : `Created ${ids.length} pieces (${ids[0]} to ${ids[ids.length - 1]})`);
      onCreated(ids);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal wide title="Add product" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Add to stock</Button></>}>
      <div className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="grid g3">
          <Field label="Name" className="grow"><input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Diamond ring" /></Field>
          <Field label="Price (₹)"><input type="number" min="0" value={f.price} onChange={set('price')} /></Field>
          <Field label="Branch"><select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.filter((b) => b.active !== false).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        </div>
        <div className="grid g4">
          <Field label="Category"><select value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Metal"><select value={f.metal} onChange={set('metal')}>{METALS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Purity"><select value={f.purity} onChange={set('purity')}>{PURITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="HUID (optional)"><input value={f.huid} onChange={set('huid')} /></Field>
        </div>
        <div className="grid g3">
          <Field label="Gross weight (g)"><input type="number" step="0.001" min="0" value={f.grossWeight} onChange={set('grossWeight')} /></Field>
          <Field label="Net weight (g)"><input type="number" step="0.001" min="0" value={f.netWeight} onChange={set('netWeight')} /></Field>
          <Field label="How many pieces?" hint="Each piece gets its own ID and label"><input type="number" min="1" max={MAX_PIECES_PER_CALL} value={f.qty} onChange={set('qty')} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ CSV / Excel upload
export function UploadModal({ defaultBranchId, onClose, onCreated }) {
  const { actor, branches } = useApp();
  const toast = useToast();
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const parsed = useMemo(() => (text.trim() ? parseStockCsv(text, branches, branchId) : null), [text, branches, branchId]);
  const good = parsed?.rows.filter((r) => !r.error) || [];
  const bad = parsed?.rows.filter((r) => r.error) || [];
  const pieces = good.reduce((s, r) => s + r.qty, 0);

  async function readFile(e) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
  }

  async function run() {
    setBusy(true);
    setError('');
    const created = [];
    try {
      const groups = {};
      good.forEach((r) => { (groups[r.branchId] ||= []).push(r); });
      for (const [bid, rows] of Object.entries(groups)) {
        let chunk = [];
        let count = 0;
        const flush = async () => {
          if (!chunk.length) return;
          setProgress(`Importing… ${created.length} of ${pieces} pieces done`);
          created.push(...(await addProducts(actor, { branchId: bid, items: chunk, note: 'CSV upload' })));
          chunk = [];
          count = 0;
        };
        for (const r of rows) {
          if (count + r.qty > MAX_PIECES_PER_CALL) await flush();
          chunk.push({ ...r.item, qty: r.qty });
          count += r.qty;
        }
        await flush();
      }
      toast.success(`Imported ${created.length} pieces`);
      onCreated(created);
    } catch (e) {
      if (created.length) {
        // earlier batches are already saved: say so, and close so nobody re-uploads them by mistake
        toast.error(`${e.message} - ${created.length} pieces were imported before this error. Check Inventory before uploading again.`);
        onCreated(created);
      } else setError(e.message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <Modal
      wide
      title="Upload inventory"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} disabled={!good.length} onClick={run}>{progress || `Import ${pieces} piece${pieces === 1 ? '' : 's'}`}</Button></>}
    >
      <div className="stack">
        {error && <div className="alert error">{error}</div>}
        <div className="alert info small">
          Columns: <b>name</b>, <b>price</b> (required) · category, metal, purity, gross_weight, net_weight, huid, <b>branch</b> (branch code) and <b>qty</b> (how many pieces).
          Export from Excel as CSV, or copy the cells and paste them below.{' '}
          <button className="btn ghost sm" type="button" onClick={() => downloadCsv('inventory-template.csv', CSV_TEMPLATE.trim().split('\n').map((l) => l.split(',')))}><Download size={13} /> Download template</button>
        </div>
        <div className="grid g2">
          <Field label="Branch for rows with no 'branch' column">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>{branches.filter((b) => b.active !== false).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select>
          </Field>
          <Field label="CSV file"><input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={readFile} /></Field>
        </div>
        <Field label="…or paste rows here (including the header line)"><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'name,price,net_weight,branch,qty\nGold ring,25000,3.2,NGP01,5'} /></Field>

        {parsed?.errors.length > 0 && <div className="alert error">{parsed.errors.join(' ')}</div>}
        {parsed && !parsed.errors.length && (
          <>
            <div className="row wrap">
              <span className="badge green">{good.length} rows ready · {pieces} pieces</span>
              {bad.length > 0 && <span className="badge red">{bad.length} rows have problems (they will be skipped)</span>}
              {parsed.unknownColumns.length > 0 && <span className="badge amber">Ignored columns: {parsed.unknownColumns.join(', ')}</span>}
            </div>
            <div className="tbl-wrap" style={{ maxHeight: 260, overflow: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>Line</th><th>Name</th><th>Metal</th><th className="r">Price</th><th>Branch</th><th className="r">Qty</th><th>Check</th></tr></thead>
                <tbody>
                  {parsed.rows.slice(0, 200).map((r) => (
                    <tr key={r.line} style={r.error ? { background: 'var(--red-soft)' } : undefined}>
                      <td>{r.line}</td><td>{r.item.name}</td><td>{r.item.purity} {r.item.metal}</td>
                      <td className="r mono">{inr(r.item.price)}</td><td>{branches.find((b) => b.id === r.branchId)?.code || '-'}</td><td className="r">{r.qty}</td>
                      <td>{r.error ? <span style={{ color: 'var(--red)' }}>{r.error}</span> : '✓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.rows.length > 200 && <div className="small muted">Showing the first 200 rows; all valid rows will be imported.</div>}
          </>
        )}
        {!text.trim() && <div className="muted small center"><Upload size={16} style={{ verticalAlign: -3 }} /> Choose a file or paste rows to preview them before importing.</div>}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ distribute to a branch
export function MoveModal({ products, onClose, onDone }) {
  const { actor, branches } = useApp();
  const toast = useToast();
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = branches.filter((b) => b.active !== false);
  const sameBranch = to && products.filter((p) => p.branchId === to).length;

  async function go() {
    setBusy(true);
    setError('');
    try {
      const n = await distributeProducts(actor, { productIds: products.map((p) => p.id), toBranchId: to });
      toast.success(`${n} piece${n === 1 ? '' : 's'} moved to ${branches.find((b) => b.id === to)?.name}`);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Move ${products.length} piece${products.length === 1 ? '' : 's'} to a branch`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="gold" loading={busy} disabled={!to || sameBranch > 0} onClick={go}>Move now</Button></>}>
      <div className="stack">
        {error && <div className="alert error">{error}</div>}
        <Field label="Send to">
          <select value={to} onChange={(e) => setTo(e.target.value)} autoFocus>
            <option value="">Choose branch…</option>
            {options.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </select>
        </Field>
        {sameBranch > 0 && <div className="alert warn">{sameBranch} selected piece(s) are already at that branch. Deselect them first.</div>}
        <div className="small muted">The stock moves straight away and shows up in that branch's billing. Every move is recorded in the piece's history.</div>
        <div className="small" style={{ maxHeight: 120, overflow: 'auto' }}>{products.map((p) => `${p.id} ${p.name}`).join(' · ')}</div>
      </div>
    </Modal>
  );
}
