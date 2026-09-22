import { useState } from 'react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { saveCompany, saveRules } from '../services/admin';
import { Button, Card, Field, PageHeader } from '../components/ui';

export default function Settings() {
  const { actor, company, rules, refreshConfig } = useApp();
  const toast = useToast();
  const [co, setCo] = useState(company);
  const [r, setR] = useState(rules);
  const [busy, setBusy] = useState('');
  const setC = (k) => (e) => setCo((x) => ({ ...x, [k]: e.target.value }));

  async function run(key, fn) {
    setBusy(key);
    try { await fn(); await refreshConfig(); toast.success('Saved'); } catch (e) { toast.error(e); } finally { setBusy(''); }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="stack">
        <Card title="Old-bill offer &amp; GST">
          <div className="stack">
            <div className="grid g3">
              <Field label="Old-bill offer (% off the next purchase)" hint="A customer's unused old bill gives this much off. Works once per bill, at any branch."><input type="number" min="1" max="100" value={r.offerPercent} onChange={(e) => setR((x) => ({ ...x, offerPercent: e.target.value }))} /></Field>
              <Field label="GST on bills (%)" hint="Ask your accountant. 0 = no GST line."><input type="number" min="0" step="0.01" value={r.gstPercent} onChange={(e) => setR((x) => ({ ...x, gstPercent: e.target.value }))} /></Field>
            </div>
            <div><Button variant="gold" loading={busy === 'rules'} onClick={() => run('rules', () => saveRules(actor, r))}>Save</Button></div>
          </div>
        </Card>

        <Card title="Shop details (printed on bills)">
          <div className="stack">
            <div className="grid g3">
              <Field label="Shop name"><input value={co.name} onChange={setC('name')} /></Field>
              <Field label="GSTIN"><input value={co.gstin} onChange={setC('gstin')} /></Field>
              <Field label="Phone"><input value={co.phone} onChange={setC('phone')} /></Field>
            </div>
            <Field label="Address"><input value={co.address} onChange={setC('address')} /></Field>
            <Field label="Bill footer"><input value={co.invoiceFooter} onChange={setC('invoiceFooter')} /></Field>
            <div><Button variant="gold" loading={busy === 'co'} onClick={() => run('co', () => saveCompany(actor, co))}>Save</Button></div>
          </div>
        </Card>
      </div>
    </>
  );
}
