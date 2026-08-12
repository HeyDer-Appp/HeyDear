import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

const CITIES = ['Auckland', 'Wellington'];

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

function dateKey(iso) {
  return iso ? new Date(iso).toISOString().split('T')[0] : null;
}

const MESSAGE_TYPES = [
  { type: 'group_found', label: 'Group Found', sentField: 'email_group_found_sent' },
  { type: 'glimpse', label: 'Group Glimpse', sentField: 'email_glimpse_sent' },
  { type: 'venue', label: 'Venue Glimpse', sentField: 'email_venue_sent' },
  { type: 'reminder', label: 'Reminder', sentField: 'email_reminder_sent' },
  { type: 'feedback', label: 'Feedback', sentField: 'email_feedback_sent' },
];

function TableCard({ table, onUnconfirm, onSendEmail }) {
  const [showSend, setShowSend] = useState(false);
  const members = table.members || [];
  const dietaryMembers = members.filter(m => dietaryLabel(m));

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-sans font-semibold text-cream text-sm">
          Table {table.table_number || '—'}
          <span className="font-sans text-cream/40 text-xs ml-2">{members.length}/6</span>
        </h3>
        <button
          onClick={() => onUnconfirm(table.id)}
          className="text-xs px-2 py-1 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
        >
          Unconfirm
        </button>
      </div>

      <p className="font-sans text-cream/60 text-sm">
        {table.restaurant_name || <span className="text-cream/30 italic">No restaurant assigned</span>}
        {table.booking_name && <span className="text-cream/40"> · {table.booking_name}</span>}
      </p>

      {members.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
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
        <p className="text-orange-400/80 text-xs mt-1.5 italic">
          ⚠ {dietaryMembers.length} {dietaryMembers.length === 1 ? 'person needs' : 'people need'} dietary attention
        </p>
      )}

      <div className="mt-3 pt-2 border-t border-white/5">
        <button
          onClick={() => setShowSend(!showSend)}
          className="text-xs text-gold/80 hover:text-gold font-sans transition-colors"
        >
          Send message ▾
        </button>
        {showSend && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MESSAGE_TYPES.map(({ type, label, sentField }) => {
              const sentCount = members.filter(m => m[sentField]).length;
              const allSent = members.length > 0 && sentCount === members.length;
              return (
                <button
                  key={type}
                  onClick={() => { onSendEmail(table.id, type); setShowSend(false); }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors font-sans ${
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
        )}
      </div>
    </div>
  );
}

function DinnerGroup({ dinner, tables, onUnconfirm, onSendEmail, onUpdateStatus, compact }) {
  const statusColor = (s) => ({ upcoming: 'text-blue-400', confirmed: 'text-emerald-400', completed: 'text-cream/40' }[s] || '');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="font-sans font-semibold text-cream text-sm">
            {new Date(dinner.date).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <p className="font-sans text-cream/40 text-xs">{dinner.city} · {tables.length} confirmed {tables.length === 1 ? 'table' : 'tables'}</p>
        </div>
        {!compact && (
          <div className="flex gap-2 items-center">
            <span className={`font-sans text-xs capitalize ${statusColor(dinner.status)}`}>{dinner.status}</span>
            {['upcoming', 'confirmed', 'completed'].map(s => (
              <button
                key={s}
                onClick={() => onUpdateStatus(dinner.id, s)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${dinner.status === s ? 'border-gold/40 text-gold' : 'border-white/10 text-cream/40 hover:border-gold/20'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {tables.length === 0 ? (
        <div className="card text-center py-6">
          <p className="font-sans text-cream/40 text-xs mb-2">No confirmed tables yet for this dinner</p>
          <Link to={`/admin/matching?dinner=${dinner.id}`} className="text-gold text-xs hover:text-yellow transition-colors">
            Build tables in Matching →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tables.map(t => (
            <TableCard key={t.id} table={t} onUnconfirm={onUnconfirm} onSendEmail={onSendEmail} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDinners() {
  const [dinners, setDinners] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [newDinner, setNewDinner] = useState({ date: '', city: 'Auckland', status: 'upcoming' });
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [dateInitialized, setDateInitialized] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, t] = await Promise.all([
        api.get('/admin/dinners'),
        api.get('/admin/matching/confirmed-tables'),
      ]);
      setDinners(d.data.dinners || []);
      setTables(t.data.tables || []);
    } catch { toast.error('Failed to load dinners'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingDinners = dinners
    .filter(d => new Date(d.date) >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastDinners = dinners
    .filter(d => new Date(d.date) < today)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Default the date filter to the nearest upcoming Tuesday, once dinners have loaded.
  useEffect(() => {
    if (!dateInitialized && upcomingDinners.length) {
      setSelectedDate(dateKey(upcomingDinners[0].date));
      setDateInitialized(true);
    }
  }, [dinners, dateInitialized]);

  const tablesByDinnerId = tables.reduce((acc, t) => {
    (acc[t.dinnerId] ||= []).push(t);
    return acc;
  }, {});

  const dateOptions = [...new Set(upcomingDinners.map(d => dateKey(d.date)))];

  const visibleDinners = upcomingDinners.filter(d =>
    (!selectedDate || dateKey(d.date) === selectedDate) &&
    (selectedCity === 'All' || d.city === selectedCity)
  );

  const pastGroups = pastDinners
    .map(d => ({ dinner: d, tables: tablesByDinnerId[d.id] || [] }))
    .filter(g => g.tables.length > 0);

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
    setDinners(prev => prev.map(d => d.id === dinnerId ? { ...d, status } : d));
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

  return (
    <AdminLayout title="Dinners">
      <div className="space-y-6 max-w-3xl">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2 className="font-sans font-semibold text-cream text-sm">Confirmed Tables</h2>
            <p className="font-sans text-cream/40 text-xs mt-0.5">Send messages per table for the dinner you pick below.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-outline text-xs py-2 px-4 flex-shrink-0">+ New Dinner</button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div>
            <label className="font-sans text-cream/50 text-xs block mb-1">Date</label>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-field py-2 text-sm w-56"
            >
              {dateOptions.length === 0 && <option value="">No upcoming dinners</option>}
              {dateOptions.map(dk => (
                <option key={dk} value={dk}>
                  {new Date(dk).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-sans text-cream/50 text-xs block mb-1">Location</label>
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="input-field py-2 text-sm w-40"
            >
              <option value="All">All cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
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
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
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
        ) : visibleDinners.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-sans text-cream/40 text-sm mb-3">No upcoming dinner matches this date and location</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-4 inline-block">
              + New Dinner
            </button>
          </div>
        ) : visibleDinners.map(d => (
          <DinnerGroup
            key={d.id}
            dinner={d}
            tables={tablesByDinnerId[d.id] || []}
            onUnconfirm={unconfirmTable}
            onSendEmail={sendEmail}
            onUpdateStatus={updateDinnerStatus}
          />
        ))}

        {pastGroups.length > 0 && (
          <div className="pt-4 border-t border-white/5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="font-sans text-cream/50 hover:text-cream text-xs transition-colors"
            >
              {showHistory ? '▾' : '▸'} History — {pastGroups.length} past {pastGroups.length === 1 ? 'dinner' : 'dinners'} with confirmed tables
            </button>
            {showHistory && (
              <div className="mt-4 space-y-6">
                {pastGroups.map(g => (
                  <DinnerGroup
                    key={g.dinner.id}
                    dinner={g.dinner}
                    tables={g.tables}
                    onUnconfirm={unconfirmTable}
                    onSendEmail={sendEmail}
                    onUpdateStatus={updateDinnerStatus}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
