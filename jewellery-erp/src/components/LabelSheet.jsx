import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { useApp } from '../context/Auth';
import { inr } from '../lib/money';
import { Button } from './ui';
import Barcode from './Barcode';

/**
 * Print-ready product labels. The barcode encodes the Product ID, so any USB/Bluetooth
 * barcode scanner (or the billing search box) finds the piece instantly. Prints 3 labels
 * across on A4. Rendered in a portal so the print stylesheet can hide the rest of the app.
 */
export default function LabelSheet({ products, onClose }) {
  const { company } = useApp();
  return createPortal(
    <div className="label-portal">
      <div className="label-bar no-print">
        <div><b>{products.length}</b> label{products.length === 1 ? '' : 's'} ready</div>
        <div className="row">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="gold" onClick={() => window.print()}><Printer size={16} /> Print labels</Button>
        </div>
      </div>
      <div className="label-grid">
        {products.map((p) => (
          <div className="label" key={p.id}>
            <Barcode value={p.id} height={54} width={1.15} displayValue={false} />
            <div className="label-t">
              {company?.name && <div className="label-shop">{company.name}</div>}
              <div className="label-id">{p.id}</div>
              <div className="label-n">{p.name}</div>
              <div className="label-m">{p.purity} {p.metal}{p.netWeight ? ` · ${p.netWeight} g` : ''}</div>
              <div className="label-p">{inr(p.price)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
