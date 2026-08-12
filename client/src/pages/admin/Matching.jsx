import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

const COUNTRY_FLAGS = {
  'New Zealand': '🇳🇿', 'Australia': '🇦🇺', 'India': '🇮🇳',
  'United Kingdom': '🇬🇧', 'United States': '🇺🇸', 'USA': '🇺🇸',
  'China': '🇨🇳', 'Philippines': '🇵🇭', 'South Africa': '🇿🇦',
  'Canada': '🇨🇦', 'Fiji': '🇫🇯', 'Samoa': '🇼🇸', 'Tonga': '🇹🇴',
  'South Korea': '🇰🇷', 'Japan': '🇯🇵', 'Singapore': '🇸🇬',
};

function getFlag(country) {
  return COUNTRY_FLAGS[country] || '🌏';
}

function getAge(dob) {
  if (!dob) return '—';
  const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  return age;
}

const ROLE_TAGS = {
  'Comes up with the wild ideas': '💡 Ideas',
  'Keeps everyone on track': '🧭 Organizer',
  "Makes sure no one's left out": '🤝 Includer',
  'Pushes the group to actually decide something': '⚡ Closer',
  'Asks the smart, cautious questions': '🔍 Analyst',
  'Knows someone for everything': '🌐 Connector',
};

function roleTag(role) {
  return ROLE_TAGS[role] || role;
}

function dietaryLabel(person) {
  const items = (person.dietary || []).filter(d => d && d !== 'Not Applicable');
  if (!items.length) return null;
  const parts = items.map(d => d === 'Other' && person.dietary_other ? person.dietary_other : d);
  return parts.join(', ');
}

function tableWarnings(members) {
  const warnings = [];
  if (!members || members.length < 2) return warnings;

  const genders = members.map(m => m.gender);
  const males = genders.filter(g => g === 'Male').length;
  const females = genders.filter(g => g === 'Female').length;
  const total = members.length;

  const validRatios = ['3M3F','4M2F','2M4F','4M1F','1M4F','5M1F','1M5F'];
  const ratio = `${males}M${females}F`;
  if (total >= 4 && !validRatios.includes(ratio) && males + females === total) {
    warnings.push({ level: 'red', msg: `Gender ratio ${ratio} may be unbalanced` });
  }

  const ages = members.map(m => getAge(m.dob)).filter(a => a !== '—');
  if (ages.length >= 2) {
    const range = Math.max(...ages) - Math.min(...ages);
    if (range > 10) warnings.push({ level: 'red', msg: `Age range is ${range} years (max 10 recommended)` });
  }

  const reliabilities = members.map(m => parseInt(m.reliability_score)).filter(r => !isNaN(r));
  if (reliabilities.length >= 2) {
    const diff = Math.max(...reliabilities) - Math.min(...reliabilities);
    if (diff > 4) warnings.push({ level: 'yellow', msg: `Reliability gap of ${diff} points` });
  }

  const intents = [...new Set(members.map(m => m.intent).filter(Boolean))];
  if (intents.length > 1) warnings.push({ level: 'yellow', msg: 'Mixed intent (meaningful + fun)' });

  return warnings;
}

function PersonCard({ person, tableId, onRemove, onHoldOver, onAddNote, onFlagRisk, draggable, onDragStart }) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState(person.admin_note || '');
  const age = getAge(person.dob);
  const flag = getFlag(person.country);
  const isRisk = person.no_show_risk;
  const isHeld = person.held_over;
  const dietary = dietaryLabel(person);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-xl border p-4 mb-3 cursor-grab active:cursor-grabbing select-none transition-all ${
        isRisk ? 'border-red-500/40 bg-red-500/5' :
        isHeld ? 'border-yellow/30 bg-yellow/5 opacity-60' :
        'border-white/8 bg-dark-card hover:border-gold/30'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-cream text-sm">
              {person.first_name} {person.last_name?.[0]}.
            </span>
            <span className="text-base leading-none">{flag}</span>
            {isRisk && <span className="text-red-400 text-xs font-bold">⚠ Risk</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-sans text-cream/40 text-xs">{age}y · {person.gender}</span>
            {person.reliability_score !== undefined && (
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                person.reliability_score >= 7 ? 'bg-emerald-500/15 text-emerald-400' :
                person.reliability_score >= 4 ? 'bg-yellow/15 text-yellow' :
                'bg-red-500/15 text-red-400'
              }`}>
                R{person.reliability_score}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {onHoldOver && (
            <button
              onClick={() => onHoldOver(person)}
              title="Hold over to next week"
              className="w-6 h-6 rounded text-cream/30 hover:text-yellow hover:bg-yellow/10 transition-colors text-xs flex items-center justify-center"
            >⏸</button>
          )}
          {onFlagRisk && (
            <button
              onClick={() => onFlagRisk(person)}
              title="Flag as no-show risk"
              className="w-6 h-6 rounded text-cream/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs flex items-center justify-center"
            >⚑</button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(person)}
              title="Remove from table"
              className="w-6 h-6 rounded text-cream/30 hover:text-cream hover:bg-white/10 transition-colors text-xs flex items-center justify-center"
            >✕</button>
          )}
        </div>
      </div>

      {dietary && (
        <p className="text-orange-400 text-xs font-sans mb-2">🍽 {dietary}</p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {person.personality && (
          <span className="bg-gold/10 text-gold text-xs px-2 py-0.5 rounded-full">{person.personality}</span>
        )}
        {person.intent && (
          <span className="bg-slate/50 text-cream/60 text-xs px-2 py-0.5 rounded-full">{person.intent === 'Meaningful friendships' ? '💙 Meaningful' : '🎉 Fun night'}</span>
        )}
        {person.budget && (
          <span className="bg-deep-card text-cream/50 text-xs px-2 py-0.5 rounded-full">{person.budget}</span>
        )}
        {person.group_role && (
          <span className="bg-purple-500/10 text-purple-300 text-xs px-2 py-0.5 rounded-full">{roleTag(person.group_role)}</span>
        )}
      </div>

      {/* Career snippet */}
      {person.career_description && (
        <p className="font-sans text-cream/40 text-xs leading-relaxed line-clamp-2 mb-1 italic">
          "{person.career_description}"
        </p>
      )}

      {/* Deeper compatibility signals */}
      {(person.conflict_style || person.connection_trigger) && (
        <p className="font-sans text-cream/35 text-xs leading-relaxed line-clamp-2 mb-2">
          {person.conflict_style && <>Under tension: <span className="text-cream/55">{person.conflict_style.toLowerCase()}</span>. </>}
          {person.connection_trigger && <>Connects via: <span className="text-cream/55">{person.connection_trigger.toLowerCase()}</span>.</>}
        </p>
      )}

      {/* Note */}
      {showNote ? (
        <div className="mt-2">
          <textarea
            className="w-full bg-navy/50 border border-white/10 rounded px-2 py-1.5 text-cream/70 text-xs resize-none"
            rows={2}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add note..."
          />
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { onAddNote?.(person, note); setShowNote(false); }}
              className="text-gold text-xs"
            >Save</button>
            <button onClick={() => setShowNote(false)} className="text-cream/40 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          {person.admin_note && (
            <p className="text-cream/40 text-xs mb-1 italic">📝 {person.admin_note}</p>
          )}
          <button
            onClick={() => setShowNote(true)}
            className="text-cream/25 hover:text-cream/60 text-xs transition-colors"
          >
            + note
          </button>
        </div>
      )}
    </div>
  );
}

function TableColumn({ table, restaurants, onDropPerson, onRemovePerson, onHoldOver, onAddNote, onFlagRisk, onConfirm, onUnconfirm, onEmailType, onSetRestaurant, onSetBookingName }) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [bookingName, setBookingName] = useState(table.booking_name || '');
  useEffect(() => { setBookingName(table.booking_name || ''); }, [table.booking_name]);
  const members = table.members || [];
  const warnings = tableWarnings(members);

  const males = members.filter(m => m.gender === 'Male').length;
  const females = members.filter(m => m.gender === 'Female').length;
  const outgoing = members.filter(m => m.personality === 'Outgoing').length;
  const reserved = members.filter(m => m.personality === 'Reserved').length;
  const both = members.filter(m => m.personality === 'Bit of both').length;
  const ages = members.map(m => getAge(m.dob)).filter(a => a !== '—');
  const ageRange = ages.length ? `${Math.min(...ages)}–${Math.max(...ages)}` : '—';
  const budgets = [...new Set(members.map(m => m.budget).filter(Boolean))];
  const dietaryMembers = members.filter(m => dietaryLabel(m));

  return (
    <div
      className={`flex-shrink-0 w-72 flex flex-col rounded-2xl border transition-all ${
        draggingOver ? 'border-gold/50 bg-gold/5' : 'border-white/8 bg-slate/20'
      }`}
      onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDraggingOver(false);
        const data = JSON.parse(e.dataTransfer.getData('person'));
        onDropPerson(data, table.id);
      }}
    >
      {/* Table header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-sans font-semibold text-cream text-sm">
            Table {table.table_number || '—'}
          </h3>
          <div className="flex gap-2 items-center">
            <span className="font-sans text-cream/40 text-xs">{members.length}/6</span>
            {table.status === 'confirmed' && (
              <span className="text-emerald-400 text-xs">✓ Confirmed</span>
            )}
          </div>
        </div>

        {onSetRestaurant && (
          <select
            value={table.restaurantId || ''}
            onChange={e => onSetRestaurant(table.id, e.target.value || null)}
            className="input-field py-1.5 text-xs w-full mb-2"
          >
            <option value="">No restaurant assigned</option>
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        {onSetBookingName && (
          <input
            type="text"
            placeholder="Booking name (host)"
            value={bookingName}
            onChange={e => setBookingName(e.target.value)}
            onBlur={() => { if (bookingName !== (table.booking_name || '')) onSetBookingName(table.id, bookingName); }}
            className="input-field py-1.5 text-xs w-full mb-2"
          />
        )}

        {/* Live composition */}
        {members.length > 0 && (
          <div className="grid grid-cols-3 gap-1 text-center mb-2">
            <div className="bg-navy/60 rounded px-1 py-1">
              <p className="font-mono text-xs text-cream/60">{males}M {females}F</p>
            </div>
            <div className="bg-navy/60 rounded px-1 py-1">
              <p className="font-mono text-xs text-cream/60">🎯{outgoing} 🔇{reserved} ±{both}</p>
            </div>
            <div className="bg-navy/60 rounded px-1 py-1">
              <p className="font-mono text-xs text-cream/60">{ageRange}</p>
            </div>
          </div>
        )}

        {budgets.length > 1 && (
          <p className="text-yellow text-xs">⚠ Mixed budgets: {budgets.join(' & ')}</p>
        )}

        {dietaryMembers.length > 0 && (
          <p className="text-orange-400 text-xs mt-1">
            🍽 {dietaryMembers.map(m => `${m.first_name}: ${dietaryLabel(m)}`).join(' · ')}
          </p>
        )}

        {/* Warnings */}
        {warnings.map((w, i) => (
          <div key={i} className={`text-xs mt-1 ${w.level === 'red' ? 'text-red-400' : 'text-yellow'}`}>
            {w.level === 'red' ? '🔴' : '🟡'} {w.msg}
          </div>
        ))}
      </div>

      {/* Members */}
      <div className="flex-1 p-3 overflow-y-auto min-h-32 max-h-96">
        {members.length === 0 ? (
          <div className="h-20 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
            <p className="font-sans text-cream/20 text-xs">Drop people here</p>
          </div>
        ) : (
          members.map(member => (
            <PersonCard
              key={member.user_id}
              person={member}
              tableId={table.id}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('person', JSON.stringify({ ...member, sourceTableId: table.id }));
              }}
              onRemove={p => onRemovePerson(p, table.id)}
              onHoldOver={p => onHoldOver(p, table.id)}
              onAddNote={(p, n) => onAddNote(p, table.id, n)}
              onFlagRisk={p => onFlagRisk(p, table.id)}
            />
          ))
        )}
      </div>

      {/* Table actions */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {table.status !== 'confirmed' ? (
          <button
            onClick={() => onConfirm(table.id)}
            disabled={members.length < 2}
            className="btn-primary w-full text-xs py-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm Table
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setShowEmail(!showEmail)}
              className="btn-outline w-full text-xs py-2"
            >
              Send Email ▾
            </button>
            <button
              onClick={() => onUnconfirm(table.id)}
              className="w-full text-xs py-2 rounded-lg border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              Unconfirm Table
            </button>
            {showEmail && (
              <div className="mt-2 space-y-1">
                {['group_found', 'glimpse', 'venue', 'reminder', 'feedback'].map(type => (
                  <button
                    key={type}
                    onClick={() => { onEmailType(table.id, type); setShowEmail(false); }}
                    className="w-full text-left px-3 py-2 rounded-lg text-cream/70 hover:bg-white/5 font-sans text-xs transition-colors"
                  >
                    {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMatching() {
  const [searchParams] = useSearchParams();
  const [dinners, setDinners] = useState([]);
  const [selectedDinner, setSelectedDinner] = useState(searchParams.get('dinner') || '');
  const [unmatched, setUnmatched] = useState([]);
  const [tables, setTables] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [heldOver, setHeldOver] = useState([]);

  useEffect(() => {
    api.get('/admin/dinners').then(r => {
      setDinners(r.data.dinners || []);
      if (!selectedDinner && r.data.dinners?.length) {
        setSelectedDinner(r.data.dinners[0].id);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDinner) return;
    setLoading(true);
    // Load each section independently — a failed restaurants call won't hide people
    const loadAll = async () => {
      const [u, t, r] = await Promise.allSettled([
        api.get(`/admin/matching/unmatched/${selectedDinner}`),
        api.get(`/admin/matching/tables/${selectedDinner}`),
        api.get('/admin/restaurants'),
      ]);
      if (u.status === 'fulfilled') {
        setUnmatched(u.value.data.unmatched || []);
        setHeldOver((u.value.data.unmatched || []).filter(p => p.held_over));
      }
      if (t.status === 'fulfilled') setTables(t.value.data.tables || []);
      if (r.status === 'fulfilled') setRestaurants(r.value.data.restaurants || []);
      if (u.status === 'rejected') console.error('Unmatched failed:', u.reason?.message);
      if (r.status === 'rejected') console.warn('Restaurants failed (non-critical):', r.reason?.message);
    };
    loadAll().finally(() => setLoading(false));
  }, [selectedDinner]);

  const addTable = async () => {
    const num = tables.length + 1;
    try {
      const r = await api.post('/admin/matching/tables', {
        dinnerId: selectedDinner,
        tableNumber: num,
      });
      setTables(prev => [...prev, { ...r.data.table, members: [] }]);
    } catch { toast.error('Failed to add table'); }
  };

  const dropPerson = async (person, tableId) => {
    if (person.sourceTableId === tableId) return;

    const sourceMember = tables.flatMap(t => t.members).find(m => m.user_id === person.user_id);

    if (person.sourceTableId) {
      await api.delete(`/admin/matching/tables/${person.sourceTableId}/members/${person.user_id}`).catch(console.error);
      setTables(prev => prev.map(t =>
        t.id === person.sourceTableId
          ? { ...t, members: t.members.filter(m => m.user_id !== person.user_id) }
          : t
      ));
    } else {
      setUnmatched(prev => prev.filter(p => p.id !== person.id));
    }

    try {
      await api.post(`/admin/matching/tables/${tableId}/assign`, { userId: person.id || person.user_id });
      setTables(prev => prev.map(t =>
        t.id === tableId
          ? { ...t, members: [...t.members.filter(m => m.user_id !== person.user_id), { ...person, user_id: person.id || person.user_id }] }
          : t
      ));
    } catch {
      toast.error('Failed to assign person');
      setUnmatched(prev => [...prev, person]);
    }
  };

  const removePerson = async (person, tableId) => {
    await api.delete(`/admin/matching/tables/${tableId}/members/${person.user_id}`).catch(console.error);
    setTables(prev => prev.map(t =>
      t.id === tableId
        ? { ...t, members: t.members.filter(m => m.user_id !== person.user_id) }
        : t
    ));
    setUnmatched(prev => [...prev, { ...person, id: person.user_id }]);
  };

  const holdOver = async (person, tableId) => {
    await api.delete(`/admin/matching/tables/${tableId}/members/${person.user_id}`);
    setTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, members: t.members.filter(m => m.user_id !== person.user_id) } : t
    ));
    setHeldOver(prev => [...prev, person]);
    toast.success(`${person.first_name} held over to next week`);
  };

  const addNote = async (person, tableId, note) => {
    const member = tables.find(t => t.id === tableId)?.members.find(m => m.user_id === person.user_id);
    if (!member) return;
    try {
      await api.patch(`/admin/matching/members/${member.id}`, { admin_note: note });
      setTables(prev => prev.map(t =>
        t.id === tableId ? {
          ...t,
          members: t.members.map(m => m.user_id === person.user_id ? { ...m, admin_note: note } : m)
        } : t
      ));
    } catch { toast.error('Failed to save note'); }
  };

  const flagRisk = async (person, tableId) => {
    const member = tables.find(t => t.id === tableId)?.members.find(m => m.user_id === person.user_id);
    if (!member) return;
    const newVal = !person.no_show_risk;
    await api.patch(`/admin/matching/members/${member.id}`, { no_show_risk: newVal });
    setTables(prev => prev.map(t =>
      t.id === tableId ? {
        ...t,
        members: t.members.map(m => m.user_id === person.user_id ? { ...m, no_show_risk: newVal } : m)
      } : t
    ));
    toast(newVal ? `${person.first_name} flagged as risk` : `Risk flag removed`);
  };

  const confirmTable = async (tableId) => {
    if (!confirm('Confirm this table? This locks the grouping and triggers group emails.')) return;
    try {
      await api.post(`/admin/matching/tables/${tableId}/confirm`);
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'confirmed' } : t));
      toast.success('Table confirmed! Group found emails queued.');
    } catch { toast.error('Failed to confirm table'); }
  };

  const unconfirmTable = async (tableId) => {
    if (!confirm('Unconfirm this table? It goes back to editable, and no further emails will treat it as locked in.')) return;
    try {
      await api.post(`/admin/matching/tables/${tableId}/unconfirm`);
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'open' } : t));
      toast.success('Table unconfirmed — back to editable');
    } catch { toast.error('Failed to unconfirm table'); }
  };

  const setTableRestaurant = async (tableId, restaurantId) => {
    try {
      const res = await api.patch(`/admin/matching/tables/${tableId}`, { restaurantId });
      setTables(prev => prev.map(t =>
        t.id === tableId
          ? { ...t, restaurantId, restaurant_name: res.data.restaurant_name, restaurant_address: res.data.restaurant_address }
          : t
      ));
    } catch { toast.error('Failed to set restaurant'); }
  };

  const setTableBookingName = async (tableId, bookingName) => {
    try {
      await api.patch(`/admin/matching/tables/${tableId}`, { bookingName });
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, booking_name: bookingName || null } : t));
    } catch { toast.error('Failed to save booking name'); }
  };

  const sendEmail = async (tableId, type) => {
    try {
      const res = await api.post(`/admin/matching/email/${type}`, { tableId });
      toast.success(`Sent ${type.replace(/_/g, ' ')} email to ${res.data.sent} people`);
    } catch { toast.error('Email sending failed'); }
  };

  return (
    <AdminLayout title="Matching Workspace">
      <div className="space-y-6">
        {/* Dinner selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="font-sans text-cream/50 text-xs block mb-1">Select Tuesday</label>
            <select
              value={selectedDinner}
              onChange={e => setSelectedDinner(e.target.value)}
              className="input-field py-2 pr-8 text-sm w-64"
            >
              <option value="">Choose a dinner...</option>
              {dinners.map(d => (
                <option key={d.id} value={d.id}>
                  {new Date(d.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {' '}{d.city} ({d.attendee_count || 0} signups)
                </option>
              ))}
            </select>
          </div>

          {selectedDinner && (
            <button onClick={addTable} className="btn-outline text-xs py-2 px-4 self-end">
              + Add Table
            </button>
          )}

          <div className="ml-auto text-right">
            <p className="font-sans text-cream/40 text-xs">{unmatched.length} unmatched · {tables.length} tables</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && selectedDinner && (
          <div className="flex gap-5 overflow-x-auto pb-4">
            {/* Unmatched pool */}
            <div className="flex-shrink-0 w-72 flex flex-col rounded-2xl border border-white/8 bg-slate/10">
              <div className="p-4 border-b border-white/5">
                <h3 className="font-sans font-semibold text-cream text-sm mb-1">
                  Unmatched Pool
                </h3>
                <p className="font-sans text-cream/40 text-xs">{unmatched.filter(p => !p.held_over).length} people awaiting placement</p>
              </div>
              <div className="flex-1 p-3 overflow-y-auto max-h-[70vh] space-y-1">
                {unmatched.filter(p => !p.held_over).length === 0 ? (
                  <p className="text-cream/20 text-xs text-center py-8">All matched 🎉</p>
                ) : (
                  unmatched.filter(p => !p.held_over).map(person => (
                    <PersonCard
                      key={person.id}
                      person={person}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('person', JSON.stringify(person))}
                    />
                  ))
                )}
              </div>

              {heldOver.length > 0 && (
                <div className="border-t border-white/5 p-3">
                  <p className="font-sans text-yellow/70 text-xs mb-2">⏸ Held over ({heldOver.length})</p>
                  {heldOver.slice(0, 3).map(p => (
                    <p key={p.id} className="font-sans text-cream/40 text-xs">{p.first_name} {p.last_name?.[0]}.</p>
                  ))}
                  {heldOver.length > 3 && <p className="text-cream/30 text-xs">+{heldOver.length - 3} more</p>}
                </div>
              )}
            </div>

            {/* Table columns */}
            {tables.map(table => (
              <TableColumn
                key={table.id}
                table={table}
                restaurants={restaurants}
                onDropPerson={dropPerson}
                onRemovePerson={removePerson}
                onHoldOver={holdOver}
                onAddNote={addNote}
                onFlagRisk={flagRisk}
                onConfirm={confirmTable}
                onUnconfirm={unconfirmTable}
                onEmailType={sendEmail}
                onSetRestaurant={setTableRestaurant}
                onSetBookingName={setTableBookingName}
              />
            ))}

            {/* Empty state */}
            {tables.length === 0 && !loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="font-sans text-cream/40 text-sm mb-4">No tables yet</p>
                  <button onClick={addTable} className="btn-primary text-sm">Create First Table</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
