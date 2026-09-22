import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Button({ variant = '', size = '', block, className = '', loading, children, ...rest }) {
  return (
    <button className={`btn ${variant} ${size} ${block ? 'block' : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function Card({ title, actions, flush, className = '', children }) {
  return (
    <div className={`card ${flush ? 'flush' : ''} ${className}`}>
      {(title || actions) && (
        flush ? (
          <div className="card-h"><h3 style={{ margin: 0 }}>{title}</h3><div className="row">{actions}</div></div>
        ) : (
          <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>{title}</h3><div className="row">{actions}</div></div>
        )
      )}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-h">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`f ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="small muted">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert error">{typeof error === 'string' ? error : error.message}</div>;
}

const STATUS_TONE = {
  AVAILABLE: 'green', SOLD: 'blue', RESERVED: 'amber', IN_TRANSIT: 'amber', EXCHANGE_RETURN: 'gold', REPAIR: 'amber',
  DAMAGED: 'red', MELTING: 'red', VOIDED: '', ACTIVE: 'green', CANCELLED: 'red', COMPLETED: 'green', POSTED: 'green',
  REVERSED: 'red', CREATED: 'amber', APPROVED: 'blue', DISPATCHED: 'amber', RECEIVED: 'green',
};
export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ''}`}>{String(status || '').replace(/_/g, ' ')}</span>;
}

export function DataTable({ columns, rows, onRowClick, empty = 'Nothing to show.', footer }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>{columns.map((c) => <th key={c.key || c.header} className={c.right ? 'r' : ''}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={onRowClick ? 'click' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key || c.header} className={c.right ? 'r mono' : ''}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  );
}
