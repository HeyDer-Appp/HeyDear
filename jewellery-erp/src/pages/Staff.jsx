import { useState } from 'react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useLoad } from '../hooks/useLoad';
import { ROLES } from '../lib/constants';
import { createStaff, listUsers, sendReset, updateStaff } from '../services/admin';
import { Badge } from '../components/Badge';
import { Button, DataTable, ErrorBox, Field, Modal, PageHeader, Spinner } from '../components/ui';

export default function Staff() {
  const { actor, branches, branchName } = useApp();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(listUsers, [], []);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setModal((m) => ({ ...m, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    try {
      if (modal.uid) await updateStaff(actor, modal.uid, { name: modal.name, branchId: modal.branchId, active: modal.active });
      else await createStaff(actor, modal);
      toast.success('Saved');
      setModal(null);
      reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Staff" subtitle="Staff can bill and see stock at their own branch only. You (the owner) do everything else.">
        <Button variant="gold" onClick={() => setModal({ name: '', email: '', password: '', branchId: branches[0]?.id || '', active: true })}>Add staff</Button>
      </PageHeader>
      <ErrorBox error={error} />
      <div className="card flush">
        {loading ? <Spinner /> : <DataTable rows={data.map((u) => ({ ...u, id: u.uid }))} onRowClick={(u) => u.role === 'staff' && setModal({ ...u })} columns={[
          { header: 'Name', render: (u) => <b>{u.name}</b> },
          { header: 'Login email', render: (u) => u.email },
          { header: 'Role', render: (u) => ROLES[u.role] },
          { header: 'Branch', render: (u) => (u.branchId ? branchName(u.branchId) : 'All branches') },
          { header: 'Status', render: (u) => <Badge tone={u.active === false ? 'red' : 'green'}>{u.active === false ? 'Blocked' : 'Active'}</Badge> },
        ]} />}
      </div>
      {modal && (
        <Modal title={modal.uid ? `Edit ${modal.name}` : 'Add staff'} onClose={() => setModal(null)} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="gold" loading={busy} onClick={save}>Save</Button></>}>
          <div className="stack">
            <Field label="Name"><input autoFocus value={modal.name} onChange={set('name')} /></Field>
            <Field label="Login email"><input type="email" value={modal.email} onChange={set('email')} disabled={!!modal.uid} /></Field>
            {!modal.uid && <Field label="Password" hint="At least 6 characters. Tell them to use 'Send reset email' to choose their own."><input type="text" value={modal.password} onChange={set('password')} /></Field>}
            <Field label="Works at branch"><select value={modal.branchId || ''} onChange={set('branchId')}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            {modal.uid && (
              <>
                <label className="check"><input type="checkbox" checked={modal.active !== false} onChange={(e) => setModal((m) => ({ ...m, active: e.target.checked }))} /> Active (untick to block their login)</label>
                <Button variant="ghost" size="sm" onClick={() => sendReset(modal.email).then(() => toast.success('Reset email sent'), toast.error)}>Send password reset email</Button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
