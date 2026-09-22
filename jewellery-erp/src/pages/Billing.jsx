import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ScanLine, Trash2, XCircle } from 'lucide-react';
import { useApp } from '../context/Auth';
import { useToast } from '../context/Toast';
import { useLoad } from '../hooks/useLoad';
import { calcBill } from '../lib/calc';
import { checkOldBill } from '../lib/offer';
import { fmtDate } from '../lib/format';
import { inr, r2 } from '../lib/money';
import { completeSale, lookupOldBill } from '../services/sales';
import { listProducts } from '../services/queries';
import CustomerPicker from '../components/CustomerPicker';
import PaymentEditor from '../components/PaymentEditor';
import ProductScan from '../components/ProductScan';
import { Button, Card, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui';

export default function Billing() {
  const { actor, branchId, branchName, rules } = useApp();
  const toast = useToast();
  const nav = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [lines, setLines] = useState([]);
  const [oldText, setOldText] = useState('');
  const [oldBill, setOldBill] = useState(null); // the looked-up bill
  const [oldError, setOldError] = useState('');
  const [looking, setLooking] = useState(false);
  const [pay, setPay] = useState([{ mode: 'CASH', amount: '', ref: '', auto: true }]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const stock = useLoad(() => (branchId ? listProducts({ branchId, status: 'AVAILABLE' }) : []), [branchId], []);
  const problem = oldBill ? checkOldBill(oldBill, rules.offerPercent) : null;
  const offerOn = !!oldBill && !problem;

  const bill = useMemo(
    () => calcBill({ subtotal: lines.reduce((s, p) => s + p.price, 0), offerPercent: offerOn ? rules.offerPercent : 0, oldBillAmount: offerOn ? oldBill.total : null, gstPercent: rules.gstPercent }),
    [lines, offerOn, oldBill, rules.offerPercent, rules.gstPercent],
  );
  const effPay = pay.length === 1 && pay[0].auto ? [{ ...pay[0], amount: bill.total }] : pay;
  const paid = r2(effPay.reduce((s, p) => s + (Number(p.amount) || 0), 0));

  if (!branchId) return <div className="alert warn">No branch selected.</div>;

  async function findOld(e) {
    e?.preventDefault();
    setOldError('');
    setOldBill(null);
    setLooking(true);
    try {
      setOldBill(await lookupOldBill(oldText));
    } catch (err) {
      setOldError(err.message);
    } finally {
      setLooking(false);
    }
  }
  const clearOld = () => { setOldBill(null); setOldText(''); setOldError(''); };

  const blocker =
    !customer ? 'Select the customer.'
    : !lines.length ? 'Add at least one piece.'
    : paid !== bill.total ? `Payment must equal ${inr(bill.total)}.`
    : '';

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await completeSale(actor, {
        branchId,
        customerId: customer.id,
        productIds: lines.map((p) => p.id),
        offer: offerOn ? { oldInvoiceId: oldBill.id } : null,
        payments: effPay.map((p) => ({ mode: p.mode, amount: Number(p.amount) || 0, ref: p.ref })),
      });
      toast.success(`Bill ${res.invoiceId} created`);
      nav(`/invoices/${res.invoiceId}`);
    } catch (e) {
      setError(e.message || String(e));
      setConfirm(false);
      stock.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New bill" subtitle={`Billing from ${branchName(branchId)}`} />
      <ErrorBox error={error} />
      <div className="two-col" style={{ marginTop: error ? 14 : 0 }}>
        <div className="stack">
          <Card title="1 · Customer"><CustomerPicker value={customer} onChange={setCustomer} /></Card>

          <Card title="2 · Pieces">
            {stock.loading ? <Spinner /> : <ProductScan products={stock.data} exclude={lines.map((l) => l.id)} onPick={(p) => setLines((l) => [...l, p])} />}
            {stock.data.length === 0 && !stock.loading && <div className="alert warn mt">There is no stock at this branch yet. The owner can add or move stock from Inventory.</div>}
            {lines.length > 0 && (
              <div className="tbl-wrap mt">
                <table className="tbl">
                  <thead><tr><th>Piece</th><th>Weight</th><th className="r">Price</th><th /></tr></thead>
                  <tbody>
                    {lines.map((p) => (
                      <tr key={p.id}>
                        <td><b>{p.id}</b> · {p.name}<div className="small muted">{p.purity} {p.metal}</div></td>
                        <td className="mono">{p.netWeight || 0} g</td>
                        <td className="r mono">{inr(p.price)}</td>
                        <td className="r"><button className="icon-btn" onClick={() => setLines((l) => l.filter((x) => x.id !== p.id))} aria-label="Remove"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`3 · Old bill offer (${rules.offerPercent}% off)`}>
            <div className="small muted mb">Customer has an old bill they have not used for the offer? Scan its barcode (or type the bill number) to get {rules.offerPercent}% off - of whichever is cheaper, the old bill or this new purchase. Each old bill works once, at any branch.</div>
            {!oldBill ? (
              <form className="row" onSubmit={findOld}>
                <div className="grow" style={{ position: 'relative' }}>
                  <ScanLine size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--muted)' }} />
                  <input style={{ paddingLeft: 38 }} value={oldText} onChange={(e) => setOldText(e.target.value)} placeholder="Scan old bill QR · or type bill number" />
                </div>
                <Button variant="ghost" loading={looking} type="submit" disabled={!oldText.trim()}>Check</Button>
              </form>
            ) : (
              <div className={`alert ${problem ? 'error' : 'ok'} row between`} style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  {problem ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                  <div>
                    <b>{oldBill.invoiceNo}</b> · {oldBill.branchName} · {fmtDate(oldBill.createdAt)} · {oldBill.customer?.name}
                    <div>{problem ? problem.message : `Valid. ${rules.offerPercent}% off ${inr(Math.min(oldBill.total, lines.reduce((s, p) => s + p.price, 0)))} is applied. Once this bill is confirmed, the old bill expires.`}</div>
                  </div>
                </div>
                <button className="btn ghost sm" onClick={clearOld}>Remove</button>
              </div>
            )}
            {oldError && <div className="alert error mt">{oldError}</div>}
          </Card>

          <Card title="4 · Payment">
            <PaymentEditor payments={effPay} onChange={(x) => setPay(x.map((p) => ({ ...p, auto: false })))} total={bill.total} />
          </Card>
        </div>

        <div className="sticky">
          <Card title="Bill summary">
            <div className="sum-row"><span className="muted">Pieces ({lines.length})</span><span className="mono">{inr(bill.subtotal)}</span></div>
            {bill.discount > 0 && <div className="sum-row credit"><span>{rules.offerPercent}% old-bill offer</span><span className="mono">− {inr(bill.discount)}</span></div>}
            {bill.tax > 0 && <div className="sum-row"><span className="muted">GST {bill.gstPercent}%</span><span className="mono">{inr(bill.tax)}</span></div>}
            <div className="sum-row total"><span>Total</span><span className="mono">{inr(bill.total)}</span></div>
            {blocker && <div className="small muted mt">{blocker}</div>}
            <Button variant="gold" className="lg mt" block disabled={!!blocker} onClick={() => setConfirm(true)}>Review &amp; confirm</Button>
          </Card>
        </div>
      </div>

      {confirm && (
        <Modal
          title="Confirm bill"
          onClose={() => setConfirm(false)}
          footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Back</Button><Button variant="gold" loading={busy} onClick={submit}>Create bill · {inr(bill.total)}</Button></>}
        >
          <div className="stack" style={{ gap: 8 }}>
            <div><b>{customer.name}</b> <span className="muted">{customer.mobile}</span></div>
            {lines.map((p) => <div key={p.id} className="row between"><span>{p.id} · {p.name}</span><span className="mono">{inr(p.price)}</span></div>)}
            {offerOn && <div className="row between" style={{ color: 'var(--green)' }}><span>{rules.offerPercent}% off using {oldBill.invoiceNo}</span><span className="mono">− {inr(bill.discount)}</span></div>}
            <div className="row between bold"><span>Total</span><span className="mono">{inr(bill.total)}</span></div>
            {offerOn && <div className="small muted">{oldBill.invoiceNo} will expire and cannot be used for the offer again.</div>}
          </div>
        </Modal>
      )}
    </>
  );
}
