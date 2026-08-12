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

const MESSAGE_TYPES = [
  { type: 'group_found', label: 'Group Found', sentField: 'email_group_found_sent' },
  { type: 'glimpse', label: 'Group Glimpse', sentField: 'email_glimpse_sent' },
  { type: 'venue', label: 'Venue Glimpse', sentField: 'email_venue_sent' },
  { type: 'reminder', label: 'Reminder', sentField: 'email_reminder_sent' },
  { type: 'feedback', label: 'Feedback', sentField: 'email_feedback_sent' },
];

function TableCard({ table, onUnconfirm, onSendEmail }) {
  const members = table.members || [];
  const dietaryMembers = members.filter(m => dietaryLabel(m));

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-sans font-semibold text-cream">
          Table {table.table_number || '—'}
          <span className="font-sans text-cream/40 text-xs ml-2">{members.length}/6</span>
        </h3>
        <button
          onClick={() => onUnconfirm(table.id)}
          className="text-xs px-3 py-1 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
        >
          Unconfirm
        </button>
      </div>

      <p className="font-sans text-cream/60 text-sm mb-1">
        {table.restaurant_name || <span className="text-cream/30 italic">No restaurant assigned</span>}
      </p>
      {table.restaurant_address && <p className="font-sans text-cream/40 text-xs mb-2">{table.restaurant_address}</p>}
      {table.booking_name && <p className="font-sans text-cream/40 text-xs mb-2">Booked under: {table.booking_name}</p>}

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

      <div className="mt-4 pt-3 border-t border-white/5">
        <p className="font-sans text-cream/40 text-xs mb-2">Send message</p>
        <div className="flex flex-wrap gap-2">
          {MESSAGE_TYPES.map(({ type, label, sentField }) => {
            const sentCount = members.filter(m => m[sentField]).length;
            const allSent = members.length > 0 && sentCount === members.length;
            return (
              <button
                key={type}
                onClick={() => onSendEmail(table.id, type)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-sans ${
                  allSent
                    ? 'border-emerald-500/30 text-emerald-400/80 hover:border-emerald-500/50'
                    : 'border-gold/20 text-gold/80 hover:border-gold/40 hover:text-gold'
                }`}
              >
                {label} {members.length > 0 && `(${sentCount}/${members.length})`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminDinners() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDinner, setNewDinner] = useState({ date: '', city: 'Auckland', status: 'upcoming' });

  const load = async () => {
    setLoading(true);
    try {
      const t = await api.get('/admin/matching/confirmed-tables');
      setTables(t.data.tables || []);
    } catch { toast.error('Failed to load confirmed tables'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createDinner = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/dinners', newDinner);
      setShowAdd(false);
      setNewDinner({ date: '', city: 'Auckland', status: 'upcoming' });
      toast.success('Dinner created!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create dinner');
    }
  };

  const updateDinnerStatus = async (dinnerId, status) => {
    await api.put(`/admin/dinners/${dinnerId}`, { status });
    setTables(prev => prev.map(t => t.dinnerId === dinnerId ? { ...t, dinner_status: status } : t));
  };

  const unconfirmTable = async (tableId) => {
    if (!confirm('Unconfirm this table? It goes back to editable in Matching and drops off this list.')) return;
    try {
      await api.post(`/admin/matching/tables/${tableId}/unconfirm`);
      setTables(prev => prev.filter(t => t.id !== tableId));
      toast.success('Table unconfirmed');
    } catch { toast.error('Failed to unconfirm table'); }
  };

  const sendEmail = async (tableId, type) => {
    try {
      const res = await api.post(`/admin/matching/email/${type}`, { tableId });
      toast.success(`Sent ${type.replace(/_/g, ' ')} to ${res.data.sent} people`);
      load();
    } catch { toast.error('Email sending failed'); }
  };

  const statusColor = (s) => ({ upcoming: 'text-blue-400', confirmed: 'text-emerald-400', completed: 'text-cream/40' }[s] || '');

  // Group confirmed tables by dinner, in dinner-date order (already sorted by the API).
  const groups = [];
  const seenDinners = new Set();
  for (const t of tables) {
    if (!seenDinners.has(t.dinnerId)) {
      seenDinners.add(t.dinnerId);
      groups.push({ dinnerId: t.dinnerId, date: t.dinner_date, city: t.city, status: t.dinner_status, tables: [] });
    }
    groups.find(g => g.dinnerId === t.dinnerId).tables.push(t);
  }

  return (
    <AdminLayout title="Dinners">
      <div className="space-y-6 max-w-3xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-sans font-semibold text-cream text-sm">Confirmed Tables</h2>
            <p className="font-sans text-cream/40 text-xs mt-0.5">Every matched group, across every dinner. Send messages per table from here.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-outline text-xs py-2 px-4 flex-shrink-0">+ New Dinner</button>
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
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs py-2 px-5">Create</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-xs py-2 px-5">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-sans text-cream/40 text-sm mb-3">No confirmed tables yet</p>
            <Link to="/admin/matching" className="btn-primary text-xs py-2 px-4 inline-block">
              Confirm a table in Matching →
            </Link>
          </div>
        ) : groups.map(g => (
          <div key={g.dinnerId} className="space-y-3">
            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="font-sans font-semibold text-cream text-sm">
                  {g.date ? new Date(g.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown date'}
                </h3>
                <p className="font-sans text-cream/40 text-xs">{g.city} · {g.tables.length} confirmed {g.tables.length === 1 ? 'table' : 'tables'}</p>
              </div>
              <div className="flex gap-2 items-center">
                <span className={`font-sans text-xs capitalize ${statusColor(g.status)}`}>{g.status}</span>
                {['upcoming', 'confirmed', 'completed'].map(s => (
                  <button
                    key={s}
                    onClick={() => updateDinnerStatus(g.dinnerId, s)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${g.status === s ? 'border-gold/40 text-gold' : 'border-white/10 text-cream/40 hover:border-gold/20'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {g.tables.map(t => (
                <TableCard key={t.id} table={t} onUnconfirm={unconfirmTable} onSendEmail={sendEmail} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
