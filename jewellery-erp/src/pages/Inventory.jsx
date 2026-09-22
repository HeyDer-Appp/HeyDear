import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Send, Upload } from 'lucide-react';
import { useApp } from '../context/Auth';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { inr } from '../lib/money';
import { MAX_PIECES_PER_CALL } from '../services/stock';
import { listProducts } from '../services/queries';
import { AddProductModal, MoveModal, UploadModal } from '../components/StockModals';
import LabelSheet from '../components/LabelSheet';
import { Button, ErrorBox, Empty, PageHeader, Spinner, StatusBadge } from '../components/ui';

export default function Inventory() {
  const { can, branches, branchName, isOwner, profile, branchId } = useApp();
  const nav = useNavigate();
  const manage = can(P.MANAGE_STOCK);
  const { data, loading, error, reload } = useLoad(() => listProducts({ branchId: isOwner ? undefined : profile.branchId }), [isOwner], []);
  const [q, setQ] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [sel, setSel] = useState(new Set());
  const [modal, setModal] = useState('');
  const [labelIds, setLabelIds] = useState(null);

  const live = useMemo(() => data.filter((p) => p.status !== 'REMOVED'), [data]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return live.filter((p) => (!branchFilter || p.branchId === branchFilter) && (!status || p.status === status)
      && (!t || p.id.toLowerCase().includes(t) || p.name.toLowerCase().includes(t) || (p.huid || '').toLowerCase().includes(t)));
  }, [live, q, branchFilter, status]);
  const countAt = (id) => live.filter((p) => p.status === 'AVAILABLE' && (!id || p.branchId === id)).length;
  const selected = live.filter((p) => sel.has(p.id));
  const shown = rows.slice(0, 300);
  const allOn = shown.length > 0 && shown.every((p) => sel.has(p.id));

  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel((s) => { const n = new Set(s); shown.forEach((p) => (allOn ? n.delete(p.id) : n.add(p.id))); return n; });
  const labelProducts = (ids) => ids.map((id) => data.find((p) => p.id === id)).filter(Boolean);

  function created(ids) {
    reload();
    setModal('');
    if (ids.length) { setSel(new Set(ids.slice(0, MAX_PIECES_PER_CALL))); setStatus('AVAILABLE'); setBranchFilter(''); }
  }

  return (
    <>
      <PageHeader title="Inventory" subtitle={isOwner ? 'Add stock, upload a list, print labels and send pieces to branches - all from here.' : `Stock at ${branchName(profile.branchId)}`}>
        {manage && <Button variant="gold" onClick={() => setModal('add')}>+ Add product</Button>}
        {manage && <Button variant="ghost" onClick={() => setModal('upload')}><Upload size={16} /> Upload CSV</Button>}
      </PageHeader>

      {isOwner && (
        <div className="row wrap mb" style={{ gap: 8 }}>
          <button className={`btn sm ${!branchFilter ? '' : 'ghost'}`} onClick={() => setBranchFilter('')}>All branches · {countAt()}</button>
          {branches.map((b) => <button key={b.id} className={`btn sm ${branchFilter === b.id ? '' : 'ghost'}`} onClick={() => setBranchFilter(b.id)}>{b.name} · {countAt(b.id)}</button>)}
        </div>
      )}

      <div className="row wrap mb">
        <input style={{ maxWidth: 340 }} placeholder="Search Product ID, name or HUID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="AVAILABLE">In stock</option><option value="SOLD">Sold</option><option value="">All</option>
        </select>
        <span className="muted small">{rows.length} pieces</span>
        <div className="grow" />
        <Button variant="ghost" size="sm" onClick={reload}>Refresh</Button>
      </div>

      {selected.length > 0 && (
        <div className="card row wrap mb" style={{ background: 'var(--gold-soft)', borderColor: '#e3cf9b', padding: '10px 16px' }}>
          <b>{selected.length} selected</b>
          <Button size="sm" variant="gold" onClick={() => setLabelIds(selected.slice(0, 300).map((p) => p.id))}><Printer size={14} /> Print labels</Button>
          {manage && <Button size="sm" onClick={() => setModal('move')} disabled={selected.length > MAX_PIECES_PER_CALL || selected.some((p) => p.status !== 'AVAILABLE')}><Send size={14} /> Move to branch</Button>}
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          {manage && selected.length > MAX_PIECES_PER_CALL && <span className="small muted">Select up to {MAX_PIECES_PER_CALL} to move.</span>}
        </div>
      )}

      <ErrorBox error={error} />
      <div className="card flush">
        {loading ? <Spinner /> : !rows.length ? (
          <Empty>{live.length ? 'No pieces match.' : manage ? 'No stock yet. Use "Add product" or "Upload CSV" to get started.' : 'No stock at your branch yet.'}</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input className="pick" type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
                  <th>Product ID</th><th>Name</th><th>Metal</th><th className="r">Net wt</th>{isOwner && <th>Branch</th>}<th>Status</th><th className="r">Price</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="click" onClick={() => nav(`/products/${p.id}`)}>
                    <td onClick={(e) => e.stopPropagation()}><input className="pick" type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.id}`} /></td>
                    <td><b>{p.id}</b></td>
                    <td>{p.name}<div className="small muted">{p.category}</div></td>
                    <td>{p.purity} {p.metal}</td>
                    <td className="r mono">{p.netWeight || 0} g</td>
                    {isOwner && <td>{branchName(p.branchId)}</td>}
                    <td><StatusBadge status={p.status} /></td>
                    <td className="r mono">{inr(p.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > shown.length && <div className="small muted center mt">Showing the first {shown.length} of {rows.length}. Use search or a branch filter to narrow down.</div>}

      {modal === 'add' && <AddProductModal defaultBranchId={branchFilter || branchId} onClose={() => setModal('')} onCreated={created} />}
      {modal === 'upload' && <UploadModal defaultBranchId={branchFilter || branchId} onClose={() => setModal('')} onCreated={created} />}
      {modal === 'move' && <MoveModal products={selected} onClose={() => setModal('')} onDone={() => { setModal(''); setSel(new Set()); reload(); }} />}
      {labelIds && <LabelSheet products={labelProducts(labelIds)} onClose={() => setLabelIds(null)} />}
    </>
  );
}
