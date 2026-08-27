import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function statusColor(status) {
  return {
    active: 'bg-emerald-500/15 text-emerald-400',
    trialing: 'bg-emerald-500/15 text-emerald-400',
    past_due: 'bg-yellow/15 text-yellow',
    canceled: 'bg-slate/50 text-cream/50',
    unpaid: 'bg-red-500/15 text-red-400',
  }[status] || 'bg-slate/50 text-cream/60';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/admin/subscriptions')
      .then(r => { setSubscriptions(r.data.subscriptions || []); setOrphans(r.data.orphans || []); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = subscriptions.filter(s => s.status === 'active' || s.status === 'trialing').length;

  if (loading) {
    return (
      <AdminLayout title="Subscriptions">
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Subscriptions">
        <p className="font-sans text-cream/50 text-sm">Couldn't load subscriptions. Refresh to try again.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Subscriptions">
      <div className="space-y-6">
        <p className="font-sans text-cream/50 text-sm">{activeCount} active · {subscriptions.length} total</p>

        {orphans.length > 0 && (
          <div className="card border-red-500/30 bg-red-500/[0.04]">
            <p className="font-sans font-semibold text-red-400 text-sm mb-2">
              ⚠ {orphans.length} subscription{orphans.length > 1 ? 's' : ''} found in Stripe with no record here
            </p>
            <p className="font-sans text-cream/40 text-xs mb-4">
              Stripe charged these but the app never created a matching record — the exact failure this page exists to catch. Each one needs to be manually reconciled.
            </p>
            <div className="space-y-2">
              {orphans.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-navy/40 rounded-lg px-3 py-2 text-xs font-sans">
                  <span className="text-cream/70 font-mono">{o.id}</span>
                  <span className={`px-2 py-0.5 rounded-full ${statusColor(o.status)}`}>{o.status}</span>
                  <span className="text-cream/40">{o.customer_email || 'no email on file'}</span>
                  <span className="text-cream/40">renews {fmtDate(o.current_period_end)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card overflow-x-auto">
          {subscriptions.length === 0 ? (
            <p className="font-sans text-cream/40 text-sm text-center py-8">No subscriptions yet.</p>
          ) : (
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="text-left text-cream/40 text-xs uppercase tracking-widest border-b border-white/5">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Renews</th>
                  <th className="pb-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 text-cream">{s.first_name || '—'} {s.last_name || ''}</td>
                    <td className="py-3 pr-4 text-cream/60 truncate max-w-[200px]">{s.email || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(s.status)}`}>{s.status || 'unknown'}</span>
                    </td>
                    <td className="py-3 pr-4 text-cream/60">{fmtDate(s.current_period_end)}</td>
                    <td className="py-3 text-cream/40 text-xs">{s.simulated ? 'Test / simulated' : 'Stripe'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
