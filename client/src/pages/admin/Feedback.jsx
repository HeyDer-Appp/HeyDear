import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= n ? '#f0c040' : '#434c59'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [dinners, setDinners] = useState([]);
  const [dinnerId, setDinnerId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/dinners').then(r => setDinners(r.data.dinners || [])).catch(console.error);
    loadFeedback();
  }, []);

  const loadFeedback = async (did = '') => {
    setLoading(true);
    try {
      const params = did ? `?dinnerId=${did}` : '';
      const r = await api.get(`/feedback${params}`);
      setFeedback(r.data.feedback || []);
      setStats(r.data.stats);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const approve = async (id) => {
    await api.post(`/feedback/testimonials/${id}/approve`);
    setFeedback(prev => prev.map(f => f.id === id ? { ...f, testimonial_approved: true } : f));
    toast.success('Testimonial approved!');
  };

  return (
    <AdminLayout title="Feedback">
      <div className="space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Responses', value: stats.total },
              { label: 'Avg Rating', value: parseFloat(stats.avg_rating || 0).toFixed(1) + ' / 5' },
              { label: 'Avg NPS', value: parseFloat(stats.avg_nps || 0).toFixed(1) + ' / 10' },
              { label: 'Would Return', value: parseFloat(stats.return_pct || 0).toFixed(0) + '%' },
            ].map(s => (
              <div key={s.label} className="card">
                <p className="font-sans text-cream/50 text-xs mb-2">{s.label}</p>
                <p className="font-serif text-3xl text-cream">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-4">
          <select
            className="input-field py-2 text-sm w-64"
            value={dinnerId}
            onChange={e => { setDinnerId(e.target.value); loadFeedback(e.target.value); }}
          >
            <option value="">All dinners</option>
            {dinners.map(d => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {/* Feedback cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="col-span-2 card text-center py-10">
              <p className="font-sans text-cream/40">No feedback yet</p>
            </div>
          ) : feedback.map(f => (
            <div key={f.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-sans font-semibold text-cream text-sm">{f.first_name} {f.last_name}</p>
                  <p className="font-sans text-cream/40 text-xs">
                    {f.dinner_date ? new Date(f.dinner_date).toLocaleDateString('en-NZ') : '—'}
                  </p>
                </div>
                <Stars n={f.overall_rating} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Group', f.group_fit], ['Convo', f.conversation_quality], ['NPS', f.nps]].map(([l, v]) => (
                  <div key={l} className="bg-navy/60 rounded-lg py-1.5">
                    <p className="font-mono text-sm text-cream">{v ?? '—'}</p>
                    <p className="font-sans text-cream/40 text-xs">{l}</p>
                  </div>
                ))}
              </div>

              {f.surprised_by && (
                <div>
                  <p className="font-sans text-cream/40 text-xs mb-1">What surprised them:</p>
                  <p className="font-sans text-cream/70 text-sm italic">"{f.surprised_by}"</p>
                </div>
              )}

              {f.improvement && (
                <div>
                  <p className="font-sans text-cream/40 text-xs mb-1">Improvement:</p>
                  <p className="font-sans text-cream/70 text-sm">{f.improvement}</p>
                </div>
              )}

              {f.testimonial && (
                <div className="border-t border-white/5 pt-3">
                  <p className="font-sans text-cream/70 text-sm italic">"{f.testimonial}"</p>
                  {f.testimonial_name && <p className="font-sans text-cream/40 text-xs mt-1">— {f.testimonial_name}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    {f.testimonial_approved ? (
                      <span className="text-emerald-400 text-xs">✓ Approved</span>
                    ) : (
                      <button onClick={() => approve(f.id)} className="text-gold text-xs hover:text-yellow">Approve for website →</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
