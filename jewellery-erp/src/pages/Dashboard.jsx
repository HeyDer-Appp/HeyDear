import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/Auth';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { fmtDateTime, startOfDay, tsMs } from '../lib/format';
import { inr, r2 } from '../lib/money';
import { listInvoices, listProducts } from '../services/queries';
import { useBranchScope } from '../components/Filters';
import { DataTable, ErrorBox, PageHeader, Spinner, Stat, StatusBadge } from '../components/ui';

export default function Dashboard() {
  const { can, profile, branches, branchName } = useApp();
  const nav = useNavigate();
  const { branchId, control } = useBranchScope();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const { data, loading, error } = useLoad(async () => {
    const opts = { branchId: branchId || undefined };
    const [invoices, products] = await Promise.all([listInvoices({ ...opts, from: monthStart }), listProducts(opts)]);
    return { invoices, products };
  }, [branchId], { invoices: [], products: [] });

  const active = data.invoices.filter((i) => i.status === 'ACTIVE');
  const today = active.filter((i) => tsMs(i.createdAt) >= startOfDay().getTime());
  const sum = (l) => r2(l.reduce((s, i) => s + (i.total || 0), 0));
  const offers = active.filter((i) => i.offer);
  const inStock = data.products.filter((p) => p.status === 'AVAILABLE');

  return (
    <>
      <PageHeader title={`Welcome, ${profile.name.split(' ')[0]}`} subtitle="Here is how the shop looks right now.">{control}</PageHeader>
      <ErrorBox error={error} />
      {loading ? <Spinner /> : (
        <div className="stack">
          <div className="grid g4">
            <Stat label="Today's sales" value={inr(sum(today))} sub={`${today.length} bill${today.length === 1 ? '' : 's'}`} />
            <Stat label="This month" value={inr(sum(active))} sub={`${active.length} bills`} />
            <Stat label="Pieces in stock" value={inStock.length} sub={inr(sum(inStock.map((p) => ({ total: p.price }))))} />
            <Stat label="Old-bill offers used" value={offers.length} sub={`${inr(sum(offers.map((i) => ({ total: i.discount }))))} given this month`} />
          </div>
          {can(P.MANAGE_STOCK) && branches.length > 0 && (
            <div className="card flush">
              <div className="card-h"><h3 style={{ margin: 0 }}>Stock by branch</h3><Link to="/inventory">Open inventory</Link></div>
              <DataTable
                rows={branches.filter((b) => !branchId || b.id === branchId)}
                columns={[
                  { header: 'Branch', render: (b) => <b>{b.name}</b> },
                  { header: 'Pieces in stock', right: true, render: (b) => inStock.filter((p) => p.branchId === b.id).length },
                  { header: 'Value', right: true, render: (b) => inr(sum(inStock.filter((p) => p.branchId === b.id).map((p) => ({ total: p.price })))) },
                  { header: 'Sales this month', right: true, render: (b) => inr(sum(active.filter((i) => i.branchId === b.id))) },
                ]}
              />
            </div>
          )}
          <div className="row wrap">
            {can(P.CREATE_BILL) && <Link className="btn gold lg" to="/bill">New bill</Link>}
            {can(P.VIEW_STOCK) && <Link className="btn ghost lg" to="/inventory">Inventory</Link>}
          </div>
          <div className="card flush">
            <div className="card-h"><h3 style={{ margin: 0 }}>Recent bills</h3><Link to="/invoices">View all</Link></div>
            <DataTable
              rows={data.invoices.slice(0, 8)}
              onRowClick={(r) => nav(`/invoices/${r.id}`)}
              empty="No bills yet this month."
              columns={[
                { header: 'Bill', render: (r) => <b>{r.invoiceNo}</b> },
                { header: 'Date', render: (r) => fmtDateTime(r.createdAt) },
                { header: 'Customer', render: (r) => r.customer?.name },
                { header: 'Branch', render: (r) => branchName(r.branchId) },
                { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { header: 'Total', right: true, render: (r) => inr(r.total) },
              ]}
            />
          </div>
        </div>
      )}
    </>
  );
}
