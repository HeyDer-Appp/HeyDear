import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import Barcode from '../components/Barcode';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useLoad } from '../hooks/useLoad';
import { P } from '../lib/permissions';
import { PAYMENT_LABEL } from '../lib/constants';
import { fmtDateTime } from '../lib/format';
import { inr } from '../lib/money';
import { cancelInvoice } from '../services/sales';
import { getInvoice } from '../services/queries';
import { Button, ErrorBox, Field, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { actor, can, company, branches, rules } = useApp();
  const toast = useToast();
  const { data: inv, loading, error, reload } = useLoad(() => getInvoice(id), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  if (!inv) return <div className="alert warn">Bill not found.</div>;

  const branch = branches.find((b) => b.id === inv.branchId);
  const verifyUrl = `${window.location.origin}/verify/${inv.qrToken}`;
  const cancelled = inv.status === 'CANCELLED';
  const offerState = cancelled ? 'Cancelled' : inv.offerUsedBy ? `Used in ${inv.offerUsedBy}` : inv.offer ? 'Not available (this bill already got the offer)' : 'Available';

  async function cancel() {
    setBusy(true);
    try { await cancelInvoice(actor, inv.id, reason); toast.success('Bill cancelled'); setCancelling(false); setReason(''); reload(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title={inv.invoiceNo} subtitle={fmtDateTime(inv.createdAt)}>
        <StatusBadge status={inv.status} />
        {can(P.CANCEL_INVOICE) && !cancelled && <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel bill</Button>}
        <Button variant="gold" onClick={() => window.print()}><Printer size={16} /> Print / PDF</Button>
      </PageHeader>

      <div className="invoice" style={{ position: 'relative' }}>
        {cancelled && <div className="stamp">CANCELLED</div>}
        <div className="hd">
          <div>
            <h2>{company.name}</h2>
            <div className="small muted">{branch?.name} ({inv.branchCode}){branch?.address ? ` · ${branch.address}` : company.address ? ` · ${company.address}` : ''}</div>
            <div className="small muted">{[branch?.phone || company.phone, company.gstin && `GSTIN ${company.gstin}`].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="right">
            <div className="bold" style={{ fontSize: 18 }}>BILL</div>
            <div>{inv.invoiceNo}</div>
            <div className="small muted">{fmtDateTime(inv.createdAt)}</div>
          </div>
        </div>

        <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="small muted">Billed to</div>
            <div className="bold">{inv.customer.name}</div>
            <div className="small">{inv.customer.mobile}</div>
            {inv.customer.address && <div className="small muted">{inv.customer.address}</div>}
          </div>
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={verifyUrl} size={104} />
            <div className="small muted" style={{ marginTop: 4 }}>{inv.offer ? 'Scan to verify this bill' : `Scan for ${rules.offerPercent}% off next purchase`}</div>
            <Barcode value={inv.invoiceNo} height={30} width={1.2} fontSize={9} className="mt" />
          </div>
        </div>

        <table>
          <thead><tr><th>Piece</th><th>Product ID</th><th>Purity</th><th className="r">Net wt</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.productId}>
                <td>{i.name}{i.huid ? <div className="small muted">HUID {i.huid}</div> : null}</td>
                <td className="mono">{i.productId}</td>
                <td>{i.purity} {i.metal}</td>
                <td className="r mono">{i.netWeight} g</td>
                <td className="r mono">{inr(i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
          <div className="small">
            {inv.offer && (
              <div className="alert ok" style={{ marginBottom: 10 }}>
                <b>{inv.offer.percent}% offer applied</b> using old bill <Link to={`/invoices/${inv.offer.oldInvoiceId}`}>{inv.offer.oldInvoiceId}</Link> - saved {inr(inv.offer.amount)}
              </div>
            )}
            <div className="bold" style={{ marginBottom: 4 }}>Payment</div>
            {inv.payments.map((p, i) => <div key={i}>{PAYMENT_LABEL[p.mode] || p.mode}{p.ref ? ` (${p.ref})` : ''}: {inr(p.amount)}</div>)}
            {cancelled && <div style={{ color: 'var(--red)' }} className="bold">Cancelled: {inv.cancelReason}</div>}
            <div className="no-print mt"><b>Next-purchase offer on this bill:</b> {offerState}</div>
          </div>
          <div style={{ minWidth: 260 }}>
            <div className="sum-row"><span className="muted">Subtotal</span><span className="mono">{inr(inv.subtotal)}</span></div>
            {inv.discount > 0 && <div className="sum-row"><span className="muted">{inv.offer?.percent}% old-bill offer</span><span className="mono">− {inr(inv.discount)}</span></div>}
            {inv.tax > 0 && <div className="sum-row"><span className="muted">GST {inv.gstPercent}%</span><span className="mono">{inr(inv.tax)}</span></div>}
            <div className="sum-row total"><span>Total</span><span className="mono">{inr(inv.total)}</span></div>
          </div>
        </div>
        <p className="small muted center" style={{ marginTop: 26 }}>{company.invoiceFooter}</p>
      </div>

      <div className="no-print small muted center mt">Created by {inv.createdByName}. Customer link: <a href={verifyUrl} target="_blank" rel="noreferrer">{verifyUrl}</a></div>

      {cancelling && (
        <Modal title="Cancel bill" onClose={() => setCancelling(false)} footer={<><Button variant="ghost" onClick={() => setCancelling(false)}>Keep bill</Button><Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={cancel}>Cancel bill</Button></>}>
          <div className="stack">
            <div className="alert warn">The pieces go back to stock{inv.offer ? `, and the old bill ${inv.offer.oldInvoiceId} becomes usable for the offer again` : ''}. This is recorded in the activity log.</div>
            <Field label="Reason (required)"><textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
