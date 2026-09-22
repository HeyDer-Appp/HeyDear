import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { downloadCsv, fmtDateTime } from '../lib/format';
import { inr } from '../lib/money';
import { listInvoices } from '../services/queries';
import { useBranchScope, useDateRange } from '../components/Filters';
import { Badge } from '../components/Badge';
import { Button, DataTable, ErrorBox, PageHeader, Spinner, StatusBadge } from '../components/ui';

export default function Invoices() {
  const nav = useNavigate();
  const { branchId, control: branchControl } = useBranchScope();
  const dates = useDateRange(30);
  const [q, setQ] = useState('');
  const { data, loading, error } = useLoad(() => listInvoices({ branchId: branchId || undefined, from: dates.from, to: dates.to }), [branchId, dates.key], []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter((i) => i.invoiceNo.toLowerCase().includes(t) || (i.customer?.name || '').toLowerCase().includes(t) || (i.customer?.mobile || '').includes(t) || i.items.some((x) => x.productId.toLowerCase() === t));
  }, [data, q]);
  const total = rows.filter((r) => r.status === 'ACTIVE').reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageHeader title="Bills" subtitle="Bills are never deleted - the owner can cancel one with a reason.">
        {branchControl}{dates.control}
        <Button variant="ghost" size="sm" onClick={() => downloadCsv('bills.csv', [['Bill', 'Date', 'Branch', 'Customer', 'Mobile', 'Status', 'Discount', 'Total'], ...rows.map((i) => [i.invoiceNo, fmtDateTime(i.createdAt), i.branchName, i.customer?.name, i.customer?.mobile, i.status, i.discount, i.total])])}><Download size={14} /> CSV</Button>
      </PageHeader>
      <div className="mb"><input placeholder="Search bill number, customer, mobile or Product ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ErrorBox error={error} />
      <div className="card flush">
        {loading ? <Spinner /> : (
          <DataTable
            rows={rows}
            onRowClick={(r) => nav(`/invoices/${r.id}`)}
            empty="No bills in this period."
            columns={[
              { header: 'Bill', render: (r) => <b>{r.invoiceNo}</b> },
              { header: 'Date', render: (r) => fmtDateTime(r.createdAt) },
              { header: 'Customer', render: (r) => <>{r.customer?.name}<div className="small muted">{r.customer?.mobile}</div></> },
              { header: 'Branch', render: (r) => r.branchName },
              { header: 'Offer', render: (r) => (
                <div className="row wrap" style={{ gap: 4 }}>
                  {r.offer && <Badge tone="green">Got {r.offer.percent}% off</Badge>}
                  {r.status === 'ACTIVE' && (r.offerUsedBy ? <Badge tone="red">Offer used</Badge> : !r.offer && <Badge tone="gold">Offer available</Badge>)}
                </div>
              ) },
              { header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { header: 'Total', right: true, render: (r) => inr(r.total) },
            ]}
          />
        )}
      </div>
      <div className="small muted right mt">{rows.length} bills · {inr(total)} (cancelled bills excluded)</div>
    </>
  );
}
