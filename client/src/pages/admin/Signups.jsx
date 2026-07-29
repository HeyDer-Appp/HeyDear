import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

const FLAGS = {
  'New Zealand': '🇳🇿', 'Australia': '🇦🇺', 'India': '🇮🇳',
  'United Kingdom': '🇬🇧', 'United States': '🇺🇸',
};

export default function AdminSignups() {
  const [signups, setSignups] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState([]);
  const [filters, setFilters] = useState({ date: '', intent: '', gender: '', search: '' });
  const [selected, setSelected] = useState(null);

  const loadSignups = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page });
      const r = await api.get(`/admin/signups?${params}`);
      setSignups(r.data.signups || []);
      setTotal(r.data.total || 0);
      setPages(r.data.pages || 1);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadSignups(); }, [page, filters]);

  useEffect(() => {
    api.get('/admin/signups/dates').then(r => setDates(r.data.dates || [])).catch(console.error);
  }, []);

  const exportCSV = () => {
    const params = new URLSearchParams(filters);
    window.open(`/api/admin/signups/export/csv?${params}`, '_blank');
  };

  return (
    <AdminLayout title="Signups">
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="font-sans text-cream/50 text-xs block mb-1">Tuesday Date</label>
              <select
                className="input-field py-2 text-sm"
                value={filters.date}
                onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
              >
                <option value="">All dates</option>
                {dates.map(d => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-sans text-cream/50 text-xs block mb-1">Intent</label>
              <select
                className="input-field py-2 text-sm"
                value={filters.intent}
                onChange={e => setFilters(f => ({ ...f, intent: e.target.value }))}
              >
                <option value="">All</option>
                <option value="Meaningful">Meaningful friendships</option>
                <option value="fun">Fun night out</option>
              </select>
            </div>
            <div>
              <label className="font-sans text-cream/50 text-xs block mb-1">Gender</label>
              <select
                className="input-field py-2 text-sm"
                value={filters.gender}
                onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
              >
                <option value="">All</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
              </select>
            </div>
            <div>
              <label className="font-sans text-cream/50 text-xs block mb-1">Search</label>
              <input
                className="input-field py-2 text-sm w-48"
                placeholder="Name or email..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <button onClick={exportCSV} className="btn-outline text-xs py-2 px-4 self-end">Export CSV</button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Age / Gender', 'Intent', 'Personality', 'Budget', 'Date', 'Dietary', 'R-Score', 'Matched', 'Signed up'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-sans text-cream/40 text-xs font-semibold tracking-wider uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-cream/40 font-sans text-sm">Loading...</td></tr>
                ) : signups.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-cream/40 font-sans text-sm">No signups found</td></tr>
                ) : signups.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-sans text-cream text-sm">{s.first_name} {s.last_name}</span>
                        <span className="text-sm">{FLAGS[s.country] || '🌏'}</span>
                      </div>
                      <p className="font-sans text-cream/40 text-xs">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 font-sans text-cream/70 text-sm whitespace-nowrap">{getAge(s.dob)} · {s.gender}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.intent?.includes('Meaningful') ? 'bg-blue-500/15 text-blue-300' : 'bg-purple-500/15 text-purple-300'}`}>
                        {s.intent?.includes('Meaningful') ? '💙 Meaningful' : '🎉 Fun'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-cream/70 text-sm">{s.personality}</td>
                    <td className="px-4 py-3 font-sans text-cream/70 text-sm">{s.budget}</td>
                    <td className="px-4 py-3 font-sans text-cream/50 text-xs whitespace-nowrap">
                      {s.tuesday_date ? new Date(s.tuesday_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : s.preferred_date}
                    </td>
                    <td className="px-4 py-3 font-sans text-cream/50 text-xs max-w-32 truncate">
                      {s.dietary_other && (
                        <span className="text-red-400 mr-1" title={`Flagged: ${s.dietary_other}`}>🚩</span>
                      )}
                      {(Array.isArray(s.dietary) ? s.dietary : s.dietary ? [s.dietary] : []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        s.reliability_score >= 7 ? 'bg-emerald-500/15 text-emerald-400' :
                        s.reliability_score >= 4 ? 'bg-yellow/15 text-yellow' :
                        'bg-red-500/15 text-red-400'
                      }`}>{s.reliability_score ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.is_matched ? (
                        <span className="text-emerald-400 text-xs">✓ Yes</span>
                      ) : (
                        <span className="text-cream/30 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-cream/40 text-xs whitespace-nowrap">
                      {new Date(s.submitted_at).toLocaleDateString('en-NZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="font-sans text-cream/40 text-xs">{total} total</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-xs py-1.5 px-3 disabled:opacity-30">←</button>
                <span className="font-sans text-cream/60 text-xs px-2 py-1.5">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-outline text-xs py-1.5 px-3 disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signup detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur z-50 flex items-center justify-center p-6" onClick={() => setSelected(null)}>
          <div className="bg-dark-card rounded-2xl border border-white/10 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-serif text-2xl text-cream">{selected.first_name} {selected.last_name}</h2>
              <button onClick={() => setSelected(null)} className="text-cream/40 hover:text-cream text-xl">✕</button>
            </div>
            <div className="space-y-3 font-sans text-sm">
              {[
                ['Email', selected.email],
                ['Phone', selected.phone || '—'],
                ['Age', getAge(selected.dob)],
                ['Gender', selected.gender],
                ['Country', selected.country],
                ['Intent', selected.intent],
                ['Personality', selected.personality],
                ['Social battery', selected.field_LosYJHqrbpKO],
                ['Social circle', selected.social_circle],
                ['Budget', selected.budget],
                ['Dietary', (selected.dietary || []).join(', ') || 'None'],
                ['Reliability', selected.reliability_score],
                ['Life stage', selected.life_stage],
                ['Preferred date', selected.preferred_date],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-cream/40 w-36 flex-shrink-0">{k}:</span>
                  <span className="text-cream">{v || '—'}</span>
                </div>
              ))}
              {selected.dietary_other && (
                <div>
                  <p className="text-red-400 mb-1 font-semibold">🚩 Flagged dietary note:</p>
                  <p className="text-cream bg-red-500/10 border border-red-500/25 rounded-lg p-3">{selected.dietary_other}</p>
                </div>
              )}
              {selected.career_description && (
                <div>
                  <p className="text-cream/40 mb-1">Career (to a kid):</p>
                  <p className="text-cream/80 italic bg-navy/50 rounded-lg p-3">"{selected.career_description}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
