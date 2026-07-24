import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

export default function AdminDinners() {
  const [dinners, setDinners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [newDinner, setNewDinner] = useState({ date: '', city: 'Auckland', status: 'upcoming' });
  const [newRestaurant, setNewRestaurant] = useState({ name: '', address: '', booking_name: '', booking_time: '19:00', menu_price_min: 45, menu_price_max: 50, capacity: 6, notes: '' });

  useEffect(() => {
    api.get('/admin/dinners').then(r => setDinners(r.data.dinners || [])).catch(console.error);
  }, []);

  const loadRestaurants = async (dinnerId) => {
    const r = await api.get(`/admin/dinners/${dinnerId}/restaurants`);
    setRestaurants(r.data.restaurants || []);
  };

  const selectDinner = async (d) => {
    setSelected(d);
    await loadRestaurants(d.id);
  };

  const createDinner = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/admin/dinners', newDinner);
      setDinners(prev => [r.data.dinner, ...prev]);
      setShowAdd(false);
      toast.success('Dinner created!');
    } catch { toast.error('Failed to create dinner'); }
  };

  const addRestaurant = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post(`/admin/dinners/${selected.id}/restaurants`, newRestaurant);
      setRestaurants(prev => [...prev, r.data.restaurant]);
      setShowAddRestaurant(false);
      toast.success('Restaurant added!');
    } catch { toast.error('Failed to add restaurant'); }
  };

  const updateStatus = async (dinnerId, status) => {
    await api.put(`/admin/dinners/${dinnerId}`, { status });
    setDinners(prev => prev.map(d => d.id === dinnerId ? { ...d, status } : d));
    if (selected?.id === dinnerId) setSelected(d => ({ ...d, status }));
  };

  const statusColor = (s) => ({ upcoming: 'text-blue-400', confirmed: 'text-emerald-400', completed: 'text-cream/40' }[s] || '');

  return (
    <AdminLayout title="Dinners & Restaurants">
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
                <input type="date" className="input-field" required value={newDinner.date} onChange={e => setNewDinner(d => ({ ...d, date: e.target.value }))} />
                <input className="input-field" placeholder="City" value={newDinner.city} onChange={e => setNewDinner(d => ({ ...d, city: e.target.value }))} />
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

        {/* Restaurants */}
        {selected && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-sans font-semibold text-cream text-sm">
                Restaurants for{' '}
                {new Date(selected.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
              </h2>
              <button onClick={() => setShowAddRestaurant(true)} className="btn-primary text-xs py-2 px-4">+ Add Restaurant</button>
            </div>

            {showAddRestaurant && (
              <div className="card">
                <h3 className="font-sans text-sm text-cream mb-4">New Restaurant</h3>
                <form onSubmit={addRestaurant} className="space-y-3">
                  <input className="input-field" placeholder="Restaurant name *" required value={newRestaurant.name} onChange={e => setNewRestaurant(r => ({ ...r, name: e.target.value }))} />
                  <textarea className="input-field resize-none" rows={2} placeholder="Address *" required value={newRestaurant.address} onChange={e => setNewRestaurant(r => ({ ...r, address: e.target.value }))} />
                  <input className="input-field" placeholder="Booking name" value={newRestaurant.booking_name} onChange={e => setNewRestaurant(r => ({ ...r, booking_name: e.target.value }))} />
                  <div className="grid grid-cols-3 gap-3">
                    <input type="time" className="input-field" value={newRestaurant.booking_time} onChange={e => setNewRestaurant(r => ({ ...r, booking_time: e.target.value }))} />
                    <input type="number" className="input-field" placeholder="Min $" value={newRestaurant.menu_price_min} onChange={e => setNewRestaurant(r => ({ ...r, menu_price_min: e.target.value }))} />
                    <input type="number" className="input-field" placeholder="Max $" value={newRestaurant.menu_price_max} onChange={e => setNewRestaurant(r => ({ ...r, menu_price_max: e.target.value }))} />
                  </div>
                  <textarea className="input-field resize-none" rows={2} placeholder="Notes..." value={newRestaurant.notes} onChange={e => setNewRestaurant(r => ({ ...r, notes: e.target.value }))} />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary text-xs py-2 px-5">Add</button>
                    <button type="button" onClick={() => setShowAddRestaurant(false)} className="btn-outline text-xs py-2 px-5">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {restaurants.length === 0 ? (
              <div className="card text-center py-8">
                <p className="font-sans text-cream/40 text-sm">No restaurants added yet</p>
              </div>
            ) : restaurants.map(r => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-sans font-semibold text-cream">{r.name}</h3>
                  <span className="text-cream/40 text-xs">{r.table_count || 0} tables</span>
                </div>
                <p className="font-sans text-cream/60 text-sm mb-2">{r.address}</p>
                <div className="flex flex-wrap gap-3 text-xs font-sans text-cream/50">
                  {r.booking_name && <span>Booking: {r.booking_name}</span>}
                  <span>Time: {r.booking_time}</span>
                  <span>Menu: ${r.menu_price_min}–${r.menu_price_max}</span>
                </div>
                {r.notes && <p className="font-sans text-cream/40 text-xs mt-2 italic">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
