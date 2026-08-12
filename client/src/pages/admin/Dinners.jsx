import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function getAge(dob) {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
}

function dietaryLabel(person) {
  const items = (person.dietary || []).filter(d => d && d !== 'Not Applicable');
  if (!items.length) return null;
  const parts = items.map(d => d === 'Other' && person.dietary_other ? person.dietary_other : d);
  return parts.join(', ');
}

export default function AdminDinners() {
  const [dinners, setDinners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newDinner, setNewDinner] = useState({ date: '', city: 'Auckland', status: 'upcoming' });

  useEffect(() => {
    api.get('/admin/dinners').then(r => setDinners(r.data.dinners || [])).catch(console.error);
  }, []);

  const loadTables = async (dinnerId) => {
    setTablesLoading(true);
    try {
      const r = await api.get(`/admin/matching/tables/${dinnerId}`);
      setTables(r.data.tables || []);
    } catch { toast.error('Failed to load tables'); }
    setTablesLoading(false);
  };

  const selectDinner = async (d) => {
    setSelected(d);
    await loadTables(d.id);
  };

  const createDinner = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/admin/dinners', newDinner);
      setDinners(prev => [r.data.dinner, ...prev]);
      setShowAdd(false);
      toast.success('Dinner created!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create dinner');
    }
  };

  const updateStatus = async (dinnerId, status) => {
    await api.put(`/admin/dinners/${dinnerId}`, { status });
    setDinners(prev => prev.map(d => d.id === dinnerId ? { ...d, status } : d));
    if (selected?.id === dinnerId) setSelected(d => ({ ...d, status }));
  };

  const unconfirmTable = async (tableId) => {
    if (!confirm('Unconfirm this table? It goes back to editable.')) return;
    try {
      await api.post(`/admin/matching/tables/${tableId}/unconfirm`);
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'open' } : t));
      toast.success('Table unconfirmed');
    } catch { toast.error('Failed to unconfirm table'); }
  };

  const statusColor = (s) => ({ upcoming: 'text-blue-400', confirmed: 'text-emerald-400', completed: 'text-cream/40' }[s] || '');

  return (
    <AdminLayout title="Dinners">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dinners list */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-sans font-semibold text-cream text-sm">Dinners</h2>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-4">+ New Dinner</button>
          </div>

          {showAdd && (
            <div className="card">
              <h3 className="font-sans text-sm text-cream mb-4">New Dinner</h3>
              <form onSubmit={createDinner} className="space-y-3">
                <div>
                  <input type="date" className="input-field" required value={newDinner.date} onChange={e => setNewDinner(d => ({ ...d, date: e.target.value }))} />
                  <p className="font-sans text-cream/30 text-xs mt-1">HeyDer dinners only happen on Tuesdays.</p>
                </div>
                <select className="input-field" value={newDinner.city} onChange={e => setNewDinner(d => ({ ...d, city: e.target.value }))}>
                  <option value="Auckland">Auckland</option>
                  <option value="Wellington">Wellington</option>
                </select>
                <select className="input-field" value={newDinner.status} onChange={e => setNewDinner(d => ({ ...d, status: e.target.value }))}>
                  <option value="upcoming">Upcoming</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                </select>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary text-xs py-2 px-5">Create</button>
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-xs py-2 px-5">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {dinners.map(d => (
            <div
              key={d.id}
              onClick={() => selectDinner(d)}
              className={`card cursor-pointer hover:border-gold/20 transition-colors ${selected?.id === d.id ? 'border-gold/40' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-sans font-semibold text-cream">
                    {new Date(d.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="font-sans text-cream/40 text-xs mt-0.5">{d.city} · {d.attendee_count || 0} attendees · {d.table_count || 0} tables</p>
                </div>
                <span className={`font-sans text-xs capitalize ${statusColor(d.status)}`}>{d.status}</span>
              </div>
              <div className="flex gap-2 mt-3">
                {['upcoming', 'confirmed', 'completed'].map(s => (
                  <button
                    key={s}
                    onClick={e => { e.stopPropagation(); updateStatus(d.id, s); }}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${d.status === s ? 'border-gold/40 text-gold' : 'border-white/10 text-cream/40 hover:border-gold/20'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tables for selected dinner */}
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-sans font-semibold text-cream text-sm">
                Tables for{' '}
                {new Date(selected.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
              </h2>
              <Link to={`/admin/matching?dinner=${selected.id}`} className="btn-outline text-xs py-2 px-4">
                Edit in Matching →
              </Link>
            </div>

            {tablesLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tables.length === 0 ? (
              <div className="card text-center py-8">
                <p className="font-sans text-cream/40 text-sm mb-3">No tables yet for this dinner</p>
                <Link to={`/admin/matching?dinner=${selected.id}`} className="btn-primary text-xs py-2 px-4 inline-block">
                  Build tables in Matching →
                </Link>
              </div>
            ) : tables.map(t => {
              const members = t.members || [];
              const dietaryMembers = members.filter(m => dietaryLabel(m));
              return (
                <div key={t.id} className="card">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-sans font-semibold text-cream">
                      Table {t.table_number || '—'}
                      <span className="font-sans text-cream/40 text-xs ml-2">{members.length}/6</span>
                    </h3>
                    <span className={`font-sans text-xs capitalize ${t.status === 'confirmed' ? 'text-emerald-400' : 'text-cream/40'}`}>
                      {t.status === 'confirmed' ? '✓ Confirmed' : t.status || 'Open'}
                    </span>
                  </div>

                  <p className="font-sans text-cream/60 text-sm mb-1">
                    {t.restaurant_name || <span className="text-cream/30 italic">No restaurant assigned</span>}
                  </p>
                  {t.restaurant_address && <p className="font-sans text-cream/40 text-xs mb-2">{t.restaurant_address}</p>}
                  {t.booking_name && <p className="font-sans text-cream/40 text-xs mb-2">Booked under: {t.booking_name}</p>}

                  {members.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                      {members.map(m => {
                        const diet = dietaryLabel(m);
                        return (
                          <div key={m.user_id} className="flex items-center justify-between text-xs">
                            <span className="font-sans text-cream/70">
                              {m.first_name} {m.last_name?.[0]}. <span className="text-cream/30">· {getAge(m.dob)}y · {m.gender}</span>
                            </span>
                            {diet && <span className="text-orange-400 font-sans">🍽 {diet}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {dietaryMembers.length > 0 && (
                    <p className="text-orange-400/80 text-xs mt-2 italic">
                      ⚠ {dietaryMembers.length} {dietaryMembers.length === 1 ? 'person needs' : 'people need'} dietary attention
                    </p>
                  )}

                  {t.status === 'confirmed' && (
                    <button
                      onClick={() => unconfirmTable(t.id)}
                      className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
                    >
                      Unconfirm Table
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
