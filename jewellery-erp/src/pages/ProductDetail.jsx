import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { CATEGORIES, METALS, PURITIES } from '../lib/constants';
import { fmtDateTime } from '../lib/format';
import { inr } from '../lib/money';
import { removeProduct, updateProduct } from '../services/stock';
import { getProduct, productMovements } from '../services/queries';
import LabelSheet from '../components/LabelSheet';
import { Button, Card, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';

const MOVE_LABEL = { ADDED: 'Added to stock', DISTRIBUTED: 'Moved to branch', SALE: 'Sold', SALE_CANCEL: 'Sale cancelled', REMOVED: 'Removed' };

export default function ProductDetail() {
  const { id } = useParams();
  const { actor, can, branchName } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(async () => {
    const [p, moves] = await Promise.all([getProduct(id), productMovements(id.toUpperCase())]);
    return { p, moves };
  }, [id]);
  const [modal, setModal] = useState('');
  const [form, setForm] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { p, moves } = data || {};
  if (!p) return <div className="alert warn">Product not found.</div>;
  const manage = can(P.MANAGE_STOCK) && p.status === 'AVAILABLE';
  const set = (k) => (e) => setForm((x) => ({ ...x, [k]: e.target.value }));

  async function run(fn, msg, after) {
    setBusy(true);
    try { await fn(); toast.success(msg); setModal(''); setReason(''); if (after) after(); else reload(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title={p.id} subtitle={p.name}>
        <StatusBadge status={p.status} />
        <Button variant="ghost" onClick={() => setLabel(true)}><Printer size={15} /> Label</Button>
        {manage && <Button variant="ghost" onClick={() => { setForm({ ...p }); setModal('edit'); }}>Edit</Button>}
        {manage && <Button variant="ghost" onClick={() => setModal('remove')}>Remove</Button>}
      </PageHeader>

      <div className="grid g3">
        <Card title="Details">
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between"><span className="muted">Category</span><span>{p.category}</span></div>
            <div className="row between"><span className="muted">Metal / purity</span><span>{p.metal} {p.purity}</span></div>
            <div className="row between"><span className="muted">Gross / net weight</span><span className="mono">{p.grossWeight} / {p.netWeight} g</span></div>
            <div className="row between"><span className="muted">HUID</span><span>{p.huid || '-'}</span></div>
          </div>
        </Card>
        <Card title="Stock">
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between"><span className="muted">Price</span><b className="mono">{inr(p.price)}</b></div>
            <div className="row between"><span className="muted">Branch</span><span>{branchName(p.branchId)}</span></div>
            <div className="row between"><span className="muted">Sold in bill</span>{p.soldInvoiceId ? <Link to={`/invoices/${p.soldInvoiceId}`}>{p.soldInvoiceId}</Link> : <span>-</span>}</div>
          </div>
        </Card>
      </div>

      <div className="card flush mt">
        <div className="card-h"><h3 style={{ margin: 0 }}>History</h3><span className="small muted">{moves.length} events - never deleted</span></div>
        <DataTable
          rows={moves}
          empty="No history."
          columns={[
            { header: 'When', render: (m) => fmtDateTime(m.createdAt) },
            { header: 'Event', render: (m) => <b>{MOVE_LABEL[m.type] || m.type}</b> },
            { header: 'Branch', render: (m) => (m.fromBranchId && m.toBranchId && m.fromBranchId !== m.toBranchId ? `${branchName(m.fromBranchId)} → ${branchName(m.toBranchId)}` : branchName(m.toBranchId || m.fromBranchId)) },
            { header: 'Bill', render: (m) => (m.refType === 'invoice' ? <Link to={`/invoices/${m.refId}`}>{m.refId}</Link> : '-') },
            { header: 'By', render: (m) => m.userName },
            { header: 'Note', render: (m) => m.reason || '' },
          ]}
        />
      </div>

      {label && <LabelSheet products={[p]} onClose={() => setLabel(false)} />}
      {modal === 'edit' && (
        <Modal wide title={`Edit ${p.id}`} onClose={() => setModal('')} footer={<><Button variant="ghost" onClick={() => setModal('')}>Cancel</Button><Button variant="gold" loading={busy} onClick={() => run(() => updateProduct(actor, p.id, form, reason), 'Saved')}>Save</Button></>}>
          <div className="stack">
            <div className="grid g3">
              <Field label="Name"><input value={form.name} onChange={set('name')} /></Field>
              <Field label="Price (₹)"><input type="number" min="0" value={form.price} onChange={set('price')} /></Field>
              <Field label="HUID"><input value={form.huid || ''} onChange={set('huid')} /></Field>
            </div>
            <div className="grid g4">
              <Field label="Category"><select value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Metal"><select value={form.metal} onChange={set('metal')}>{METALS.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Purity"><select value={form.purity} onChange={set('purity')}>{PURITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <span />
            </div>
            <div className="grid g3">
              <Field label="Gross weight (g)"><input type="number" step="0.001" value={form.grossWeight} onChange={set('grossWeight')} /></Field>
              <Field label="Net weight (g)"><input type="number" step="0.001" value={form.netWeight} onChange={set('netWeight')} /></Field>
            </div>
            <Field label="Reason (needed only if the price changes)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. gold rate change" /></Field>
          </div>
        </Modal>
      )}
      {modal === 'remove' && (
        <Modal title="Remove this piece?" onClose={() => setModal('')} footer={<><Button variant="ghost" onClick={() => setModal('')}>Keep it</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => run(() => removeProduct(actor, p.id, reason), 'Removed from stock', () => nav('/inventory'))}>Remove</Button></>}>
          <div className="stack">
            <div className="alert warn">Use this for a wrong entry. The Product ID is never reused and its history stays.</div>
            <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
