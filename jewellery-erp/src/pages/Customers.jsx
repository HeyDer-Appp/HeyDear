import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/Auth';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { fmtDate } from '../lib/format';
import { inr } from '../lib/money';
import { listCustomers } from '../services/customers';
import { CustomerForm } from '../components/CustomerPicker';
import { Button, DataTable, ErrorBox, PageHeader, Spinner } from '../components/ui';

export default function Customers() {
  const { can } = useApp();
  const nav = useNavigate();
  const { data, loading, error } = useLoad(() => listCustomers(500), [], []);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? data.filter((c) => c.name.toLowerCase().includes(t) || c.mobile.includes(t)) : data;
  }, [data, q]);

  return (
    <>
      <PageHeader title="Customers" subtitle="One customer list shared by all branches.">
        {can(P.MANAGE_CUSTOMERS) && <Button variant="gold" onClick={() => setCreating(true)}>Add customer</Button>}
      </PageHeader>
      <div className="mb"><input placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ErrorBox error={error} />
      <div className="card flush">
        {loading ? <Spinner /> : (
          <DataTable rows={rows} onRowClick={(c) => nav(`/customers/${c.id}`)} empty="No customers found." columns={[
            { header: 'Customer', render: (c) => <b>{c.name}</b> },
            { header: 'Mobile', render: (c) => c.mobile },
            { header: 'Bills', right: true, render: (c) => c.billCount || 0 },
            { header: 'Last purchase', render: (c) => fmtDate(c.lastPurchaseAt) },
            { header: 'Total spent', right: true, render: (c) => inr(c.totalSpent) },
          ]} />
        )}
      </div>
      {creating && <CustomerForm onCancel={() => setCreating(false)} onSaved={(c) => { setCreating(false); nav(`/customers/${c.id}`); }} />}
    </>
  );
}
