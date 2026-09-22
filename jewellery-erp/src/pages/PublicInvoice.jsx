import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { fmtDateTime } from '../lib/format';
import { inr } from '../lib/money';
import { getPublicInvoice } from '../services/queries';
import { Spinner } from '../components/ui';

// Customer page opened from the bill's QR. It reads only the sanitised publicInvoices
// document: no phone number, address, staff names or internal notes.
export default function PublicInvoice() {
  const { token } = useParams();
  const { data, loading, error } = useLoad(() => getPublicInvoice(token), [token]);

  const offer = !data ? null
    : data.status !== 'ACTIVE' ? { tone: 'red', text: 'This bill is cancelled.' }
    : data.offerUsed ? { tone: 'red', text: `The ${data.offerPercent}% next-purchase offer on this bill has already been used and has expired.` }
    : !data.canGiveOffer ? { tone: '', text: 'This bill was bought with the offer, so it does not give another one.' }
    : { tone: 'green', text: `Show this QR at any branch to get ${data.offerPercent}% off your next purchase. One time only.` };

  return (
    <div className="public">
      {loading ? <Spinner /> : !data || error ? (
        <div className="card center stack">
          <XCircle size={40} style={{ color: 'var(--red)', margin: '0 auto' }} />
          <h2>Bill could not be verified</h2>
          <p className="muted">This link is not valid. Please check the QR code on your bill.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="card center">
            {data.status === 'ACTIVE' ? <CheckCircle2 size={40} style={{ color: 'var(--green)', margin: '0 auto' }} /> : <XCircle size={40} style={{ color: 'var(--red)', margin: '0 auto' }} />}
            <h2 className="serif" style={{ fontSize: 28, marginTop: 6 }}>{data.companyName}</h2>
            <div className={`badge ${data.status === 'ACTIVE' ? 'green' : 'red'}`}>{data.status === 'ACTIVE' ? 'Genuine bill' : 'Cancelled bill'}</div>
            <div className="muted small" style={{ marginTop: 8 }}>{data.invoiceNo} · {fmtDateTime(data.createdAt)} · {data.branchName}</div>
          </div>
          <div className={`alert ${offer.tone === 'green' ? 'ok' : offer.tone === 'red' ? 'error' : 'info'}`}><b>Next-purchase offer:</b> {offer.text}</div>
          <div className="card">
            <h3>Pieces</h3>
            {data.items.map((i) => (
              <div key={i.productId} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                <div><b>{i.name}</b><div className="small muted">{i.productId} · {i.purity} {i.metal} · {i.netWeight} g</div></div>
                <b className="mono">{inr(i.price)}</b>
              </div>
            ))}
            {data.discount > 0 && <div className="sum-row"><span className="muted">Offer discount</span><span className="mono">− {inr(data.discount)}</span></div>}
            {data.tax > 0 && <div className="sum-row"><span className="muted">GST</span><span className="mono">{inr(data.tax)}</span></div>}
            <div className="sum-row total"><span>Total</span><span className="mono">{inr(data.total)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
