import { useState } from 'react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { saveBranch } from '../services/admin';
import { Badge } from '../components/Badge';
import { Button, DataTable, Field, Modal, PageHeader } from '../components/ui';

const EMPTY = { name: '', code: '', address: '', phone: '', active: true };

export default function Branches() {
  const { actor, branches, refreshConfig } = useApp();
  const toast = useToast();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try { await saveBranch(actor, edit.id, edit); await refreshConfig(); toast.success('Branch saved'); setEdit(null); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Branches" subtitle="Create a branch, then add stock to it or send stock from Inventory.">
        <Button variant="gold" onClick={() => setEdit({ ...EMPTY })}>Add branch</Button>
      </PageHeader>
      <div className="card flush">
        <DataTable rows={branches} onRowClick={setEdit} columns={[
          { header: 'Code', render: (b) => <b>{b.code}</b> },
          { header: 'Branch', render: (b) => b.name },
          { header: 'Address', render: (b) => b.address || '-' },
          { header: 'Phone', render: (b) => b.phone || '-' },
          { header: 'Bill numbers look like', render: (b) => <span className="mono small">{b.code}-INV-000001</span> },
          { header: 'Status', render: (b) => <Badge tone={b.active === false ? 'red' : 'green'}>{b.active === false ? 'Closed' : 'Open'}</Badge> },
        ]} />
      </div>
      {edit && (
        <Modal title={edit.id ? `Edit ${edit.name}` : 'New branch'} onClose={() => setEdit(null)} footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save</Button></>}>
          <div className="stack">
            <div className="grid g2">
              <Field label="Branch name"><input autoFocus value={edit.name} onChange={set('name')} /></Field>
              <Field label="Branch code" hint={edit.id ? 'Fixed - it is part of every bill number' : 'Letters/digits, e.g. NGP02'}><input value={edit.code} onChange={set('code')} disabled={!!edit.id} maxLength={8} /></Field>
            </div>
            <Field label="Address"><input value={edit.address || ''} onChange={set('address')} /></Field>
            <Field label="Phone"><input value={edit.phone || ''} onChange={set('phone')} /></Field>
            {edit.id && <label className="check"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit((x) => ({ ...x, active: e.target.checked }))} /> Open (untick when the branch is closed)</label>}
          </div>
        </Modal>
      )}
    </>
  );
}
