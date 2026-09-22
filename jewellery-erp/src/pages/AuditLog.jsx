import { useMemo, useState } from 'react';
import { useLoad } from '../hooks/useLoad';
import { fmtDateTime } from '../lib/format';
import { listAudit } from '../services/queries';
import { Badge } from '../components/Badge';
import { DataTable, ErrorBox, PageHeader, Spinner } from '../components/ui';

export default function AuditLog() {
  const { data, loading, error } = useLoad(() => listAudit(400), [], []);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? data.filter((a) => JSON.stringify([a.action, a.entityId, a.userName, a.reason]).toLowerCase().includes(t)) : data;
  }, [data, q]);
  const short = (v) => (v ? JSON.stringify(v).slice(0, 140) : '');

  return (
    <>
      <PageHeader title="Audit log" subtitle="Append-only record of sensitive actions. Entries cannot be edited or deleted." />
      <div className="mb"><input placeholder="Filter by action, ID, user or reason…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ErrorBox error={error} />
      <div className="card flush">
        {loading ? <Spinner /> : <DataTable rows={rows} empty="No audit entries." columns={[
          { header: 'When', render: (a) => fmtDateTime(a.createdAt) },
          { header: 'Action', render: (a) => <Badge tone={/CANCEL|OVERRIDE|REVERSED/.test(a.action) ? 'red' : /PRICE|DISCOUNT|STATUS|RULES/.test(a.action) ? 'amber' : ''}>{a.action.replace(/_/g, ' ')}</Badge> },
          { header: 'Entity', render: (a) => <>{a.entityType} <b>{a.entityId}</b></> },
          { header: 'User', render: (a) => <>{a.userName}<div className="small muted">{a.userRole}</div></> },
          { header: 'Reason', render: (a) => a.reason || '' },
          { header: 'Change', render: (a) => <div className="small muted mono">{a.oldValue ? `${short(a.oldValue)} → ` : ''}{short(a.newValue)}</div> },
        ]} />}
      </div>
    </>
  );
}
