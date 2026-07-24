import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

const COLORS = ['#E8A854', '#f0c040', '#434c59', '#131c2e', '#F5EDD8'];

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AdminLayout title="Analytics">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout title="Analytics">
      <div className="space-y-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Signups', value: data?.totals?.allTime },
            { label: 'This Month', value: data?.totals?.thisMonth },
            { label: 'Avg NPS', value: data?.avgNps },
            { label: 'Retention Rate', value: `${data?.retentionRate}%` },
          ].map(s => (
            <div key={s.label} className="card">
              <p className="font-sans text-cream/50 text-xs tracking-wider uppercase mb-2">{s.label}</p>
              <p className="font-serif text-4xl text-cream">{s.value ?? '—'}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender split */}
          {data?.genderSplit?.length > 0 && (
            <div className="card">
              <h3 className="font-sans font-semibold text-cream text-sm mb-4">Gender Split</h3>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={data.genderSplit} dataKey="count" nameKey="gender" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                      {data.genderSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data.genderSplit.map((g, i) => (
                    <div key={g.gender} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="font-sans text-cream/70 text-xs">{g.gender}: {g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Intent split */}
          {data?.intentSplit?.length > 0 && (
            <div className="card">
              <h3 className="font-sans font-semibold text-cream text-sm mb-4">Intent Split</h3>
              <div className="space-y-3">
                {data.intentSplit.map((item, i) => {
                  const total = data.intentSplit.reduce((s, x) => s + parseInt(x.count), 0);
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.intent}>
                      <div className="flex justify-between mb-1">
                        <span className="font-sans text-cream/70 text-xs truncate">{item.intent || 'Unknown'}</span>
                        <span className="font-sans text-cream/50 text-xs">{pct}%</span>
                      </div>
                      <div className="h-2 bg-navy rounded-full">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: COLORS[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Age distribution */}
          {data?.ageDistribution?.length > 0 && (
            <div className="card">
              <h3 className="font-sans font-semibold text-cream text-sm mb-4">Age Distribution</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.ageDistribution}>
                  <XAxis dataKey="age_group" stroke="#F5EDD830" tick={{ fill: '#F5EDD870', fontSize: 11 }} />
                  <YAxis stroke="#F5EDD830" tick={{ fill: '#F5EDD870', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#131c2e', border: '1px solid rgba(245,237,216,0.08)', borderRadius: 8, color: '#F5EDD8' }} />
                  <Bar dataKey="count" fill="#E8A854" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Budget split */}
          {data?.budgetSplit?.length > 0 && (
            <div className="card">
              <h3 className="font-sans font-semibold text-cream text-sm mb-4">Budget Preference</h3>
              <div className="space-y-3">
                {data.budgetSplit.map((item, i) => {
                  const total = data.budgetSplit.reduce((s, x) => s + parseInt(x.count), 0);
                  const pct = Math.round((item.count / total) * 100);
                  return (
                    <div key={item.budget}>
                      <div className="flex justify-between mb-1">
                        <span className="font-sans text-cream/70 text-sm">{item.budget}</span>
                        <span className="font-sans text-cream/50 text-xs">{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-navy rounded-full">
                        <div className="h-2 rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top dates */}
        {data?.topDates?.length > 0 && (
          <div className="card">
            <h3 className="font-sans font-semibold text-cream text-sm mb-4">Top Signup Dates</h3>
            <div className="space-y-2">
              {data.topDates.slice(0, 8).map(d => (
                <div key={d.tuesday_date} className="flex items-center gap-3">
                  <span className="font-sans text-cream/60 text-xs w-32 flex-shrink-0">
                    {new Date(d.tuesday_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex-1 h-2 bg-navy rounded-full">
                    <div className="h-2 bg-gold rounded-full" style={{ width: `${(d.signups / data.topDates[0].signups) * 100}%` }} />
                  </div>
                  <span className="font-sans text-cream/50 text-xs w-8 text-right">{d.signups}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Country breakdown */}
        {data?.countryBreakdown?.length > 0 && (
          <div className="card">
            <h3 className="font-sans font-semibold text-cream text-sm mb-4">Geographic Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {data.countryBreakdown.map(c => (
                <div key={c.country} className="flex items-center justify-between bg-navy/60 rounded-lg px-3 py-2">
                  <span className="font-sans text-cream/70 text-xs">{c.country}</span>
                  <span className="font-sans text-gold text-sm font-semibold">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
