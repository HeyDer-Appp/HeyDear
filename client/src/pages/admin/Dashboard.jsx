import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function StatCard({ label, value, sub, href }) {
  const content = (
    <div className="card hover:border-gold/20 transition-colors">
      <p className="font-sans text-cream/50 text-xs tracking-wider uppercase mb-2">{label}</p>
      <p className="font-serif text-4xl text-cream mb-1">{value}</p>
      {sub && <p className="font-sans text-cream/40 text-xs">{sub}</p>}
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

const CITIES = ['Auckland', 'Wellington'];

export default function AdminDashboard() {
  const [city, setCity] = useState('');
  const [stats, setStats] = useState(null);
  const [upcomingDinners, setUpcomingDinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    Promise.all([
      api.get(`/admin/analytics${params}`),
      api.get(`/admin/dinners${params}`),
    ]).then(([analytics, dinners]) => {
      setStats(analytics.data);
      setUpcomingDinners(
        (dinners.data.dinners || [])
          .filter(d => d.status === 'upcoming')
          .slice(0, 5)
      );
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [city]);

  const importTypeform = async () => {
    try {
      const res = await api.post('/typeform/import');
      alert(`Imported ${res.data.imported} responses from Typeform.`);
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const exportCSV = () => {
    window.open('/api/admin/signups/export/csv', '_blank');
  };

  if (loading) return (
    <AdminLayout title="Dashboard">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-8">
        {/* City filter */}
        <div className="flex items-center gap-3">
          <label className="font-sans text-cream/50 text-xs">City</label>
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="input-field py-1.5 text-sm w-48"
          >
            <option value="">All cities</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Signups today" value={stats?.totals?.today || 0} sub="Last 24 hours" href="/admin/signups" />
          <StatCard label="Total signups" value={stats?.totals?.allTime || 0} sub="All time" href="/admin/signups" />
          <StatCard label="Avg rating" value={stats?.avgRating && stats.avgRating !== '0.0' ? stats.avgRating : '—'} sub="Out of 5" href="/admin/feedback" />
          <StatCard label="Retention" value={`${stats?.retentionRate || 0}%`} sub="Returned for 2nd dinner" />
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="font-sans font-semibold text-cream text-sm mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/matching" className="btn-primary text-xs py-2.5 px-5">Open Matching Workspace</Link>
            <Link to="/admin/signups" className="btn-outline text-xs py-2.5 px-5">View All Signups</Link>
            <button onClick={exportCSV} className="btn-outline text-xs py-2.5 px-5">Export Signups (CSV)</button>
            <button onClick={importTypeform} className="btn-outline text-xs py-2.5 px-5">Import Typeform Data</button>
          </div>
        </div>

        {/* Upcoming dinners */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-cream text-sm">Upcoming Dinners</h2>
            <Link to="/admin/dinners" className="text-gold text-xs hover:text-yellow">Manage →</Link>
          </div>
          {upcomingDinners.length === 0 ? (
            <p className="font-sans text-cream/40 text-sm py-4">No upcoming dinners{city ? ` in ${city}` : ''} yet.</p>
          ) : (
            <div className="space-y-3">
              {upcomingDinners.map(d => (
                <div key={d.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                  <div>
                    <p className="font-sans text-cream text-sm">
                      {new Date(d.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="font-sans text-cream/40 text-xs">{d.city} · {d.attendee_count || 0} attendees · {d.table_count || 0} tables</p>
                  </div>
                  <Link to={`/admin/matching?dinner=${d.id}`} className="text-gold text-xs hover:text-yellow">Match →</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gender split */}
        {stats?.genderSplit?.length > 0 && (
          <div className="card">
            <h2 className="font-sans font-semibold text-cream text-sm mb-4">Gender Split</h2>
            <div className="flex gap-4 flex-wrap">
              {stats.genderSplit.map(g => (
                <div key={g.gender} className="text-center">
                  <p className="font-serif text-2xl text-cream">{g.count}</p>
                  <p className="font-sans text-cream/40 text-xs mt-1">{g.gender}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
