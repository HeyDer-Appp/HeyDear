import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { fmtDate, fmtDateTime, tsMs } from '../lib/format';
import { inr } from '../lib/money';
import { customerInvoices, getCustomer, updateCustomer } from '../services/customers';
import { Badge } from '../components/Badge';
import { Button, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, StatusBadge } from '../components/ui';

export default function CustomerProfile() {
  const { id } = useParams();
  const { actor, can } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(async () => {
    const [customer, invoices] = await Promise.all([getCustomer(id), customerInvoices(id)]);
    return { customer, invoices: invoices.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)) };
  }, [id]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const { customer: c, invoices } = data || {};
  if (!c) return <div className="alert warn">Customer not found.</div>;
  const set = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try { await updateCustomer(actor, c.id, edit); toast.success('Saved'); setEdit(null); reload(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title={c.name} subtitle={c.mobile}>
        {can(P.MANAGE_CUSTOMERS) && <Button variant="ghost" onClick={() => setEdit({ ...c })}>Edit</Button>}
        {can(P.CREATE_BILL) && <Button variant="gold" onClick={() => nav('/bill')}>New bill</Button>}
      </PageHeader>
      <div className="grid g3 mb">
        <Stat label="Total spent" value={inr(c.totalSpent)} sub={`${c.billCount || 0} bills`} />
        <Stat label="Last purchase" value={fmtDate(c.lastPurchaseAt)} />
        <Stat label="Old-bill offers used" value={invoices.filter((i) => i.offer && i.status === 'ACTIVE').length} />
      </div>
      {c.address && <div className="small muted mb">{c.address}</div>}
      <div className="card flush">
        <div className="card-h"><h3 style={{ margin: 0 }}>Bills</h3></div>
        <DataTable rows={invoices} empty="No purchases yet." onRowClick={(i) => nav(`/invoices/${i.id}`)} columns={[
          { header: 'Bill', render: (i) => <b>{i.invoiceNo}</b> },
          { header: 'Date', render: (i) => fmtDateTime(i.createdAt) },
          { header: 'Pieces', render: (i) => i.items.map((x) => <div key={x.productId} className="small"><Link to={`/products/${x.productId}`} onClick={(e) => e.stopPropagation()}>{x.productId}</Link> {x.name}</div>) },
          { header: 'Branch', render: (i) => i.branchName },
          { header: 'Offer', render: (i) => (i.offer ? <Badge tone="green">Got {i.offer.percent}% off</Badge> : i.status === 'ACTIVE' && (i.offerUsedBy ? <Badge tone="red">Offer used</Badge> : <Badge tone="gold">Offer available</Badge>)) },
          { header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
          { header: 'Total', right: true, render: (i) => inr(i.total) },
        ]} />
      </div>
      {edit && (
        <Modal title="Edit customer" onClose={() => setEdit(null)} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save</Button></>}>
          <div className="stack">
            <Field label="Name"><input value={edit.name} onChange={set('name')} /></Field>
            <Field label="Mobile" hint="The mobile number is the lookup key and cannot be changed."><input value={edit.mobile} disabled /></Field>
            <Field label="Address"><textarea rows={2} value={edit.address || ''} onChange={set('address')} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
