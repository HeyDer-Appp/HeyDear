import { useMemo, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { inr } from '../lib/money';
import { StatusBadge } from './ui';

/**
 * Big scan/search box. A barcode scanner types the Product ID and presses Enter, so
 * Enter selects an exact ID match (or the top suggestion). `products` is the list of
 * candidates already loaded for the branch.
 */
export default function ProductScan({ products, exclude = [], onPick, placeholder = 'Scan or type Product ID / name…', autoFocus = true, priceOf }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef(null);

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter((p) => !exclude.includes(p.id) && (p.id.toLowerCase().includes(t) || (p.name || '').toLowerCase().includes(t) || (p.huid || '').toLowerCase() === t))
      .slice(0, 8);
  }, [text, products, exclude]);

  function pick(p) {
    setText('');
    setNote('');
    setHl(0);
    onPick(p);
    ref.current?.focus();
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = text.trim().toUpperCase();
      const exact = products.find((p) => p.id === t);
      if (exact) return exclude.includes(exact.id) ? setNote('Already added.') : pick(exact);
      if (matches[hl]) return pick(matches[hl]);
      if (t) setNote(`"${text.trim()}" is not an available product at this branch.`);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="row" style={{ position: 'relative' }}>
        <ScanLine size={20} style={{ position: 'absolute', left: 14, color: 'var(--muted)' }} />
        <input
          ref={ref}
          className="big-input"
          style={{ paddingLeft: 44 }}
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); setNote(''); setHl(0); }}
          onKeyDown={onKey}
        />
      </div>
      {note && <div className="small" style={{ color: 'var(--red)', marginTop: 6 }}>{note}</div>}
      {matches.length > 0 && (
        <div className="suggest">
          {matches.map((p, i) => (
            <button key={p.id} className={i === hl ? 'hl' : ''} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
              <span><b>{p.id}</b> · {p.name} <span className="muted">{p.purity} {p.metal} · {p.netWeight || 0} g</span></span>
              <span className="row"><StatusBadge status={p.status} /><b className="mono">{inr(priceOf ? priceOf(p) : p.price)}</b></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
