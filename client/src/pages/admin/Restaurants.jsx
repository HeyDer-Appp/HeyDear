import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

const emptyForm = { name: '', address: '', booking_time: '19:00', menu_price_min: 45, menu_price_max: 50, capacity: 6, notes: '' };

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/restaurants');
      setRestaurants(r.data.restaurants || []);
    } catch { toast.error('Failed to load restaurants'); }
    setLoading(false);
  };

  const addRestaurant = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/admin/restaurants', form);
      setRestaurants(prev => [...prev, r.data.restaurant].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(emptyForm);
      setShowAdd(false);
      toast.success('Restaurant added!');
    } catch { toast.error('Failed to add restaurant'); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name || '', address: r.address || '', booking_time: r.bookingTime || '19:00',
      menu_price_min: r.menuPriceMin ?? 45, menu_price_max: r.menuPriceMax ?? 50,
      capacity: r.capacity || 6, notes: r.notes || '',
    });
  };

  const saveEdit = async (id) => {
    try {
      const r = await api.put(`/admin/restaurants/${id}`, editForm);
      setRestaurants(prev => prev.map(x => x.id === id ? { ...x, ...r.data.restaurant } : x));
      setEditingId(null);
      toast.success('Restaurant updated');
    } catch { toast.error('Failed to update restaurant'); }
  };

  return (
    <AdminLayout title="Restaurants">
      <div className="space-y-4 max-w-3xl">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-sans font-semibold text-cream text-sm">Restaurant Partners</h2>
            <p className="font-sans text-cream/40 text-xs mt-0.5">Add a restaurant once when it comes on board — assign it to tables from the Matching workspace any week after.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs py-2 px-4 flex-shrink-0">+ New Restaurant</button>
        </div>

        {showAdd && (
          <div className="card">
            <h3 className="font-sans text-sm text-cream mb-4">New Restaurant</h3>
            <form onSubmit={addRestaurant} className="space-y-3">
              <input className="input-field" placeholder="Restaurant name *" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <textarea className="input-field resize-none" rows={2} placeholder="Address *" required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              <div className="grid grid-cols-3 gap-3">
                <input type="time" className="input-field" value={form.booking_time} onChange={e => setForm(f => ({ ...f, booking_time: e.target.value }))} />
                <input type="number" className="input-field" placeholder="Min $" value={form.menu_price_min} onChange={e => setForm(f => ({ ...f, menu_price_min: e.target.value }))} />
                <input type="number" className="input-field" placeholder="Max $" value={form.menu_price_max} onChange={e => setForm(f => ({ ...f, menu_price_max: e.target.value }))} />
              </div>
              <textarea className="input-field resize-none" rows={2} placeholder="Notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs py-2 px-5">Add</button>
                <button type="button" onClick={() => { setShowAdd(false); setForm(emptyForm); }} className="btn-outline text-xs py-2 px-5">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="card text-center py-8">
            <p className="font-sans text-cream/40 text-sm">No restaurant partners yet</p>
          </div>
        ) : restaurants.map(r => (
          <div key={r.id} className="card">
            {editingId === r.id ? (
              <div className="space-y-3">
                <input className="input-field" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                <textarea className="input-field resize-none" rows={2} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                <div className="grid grid-cols-3 gap-3">
                  <input type="time" className="input-field" value={editForm.booking_time} onChange={e => setEditForm(f => ({ ...f, booking_time: e.target.value }))} />
                  <input type="number" className="input-field" value={editForm.menu_price_min} onChange={e => setEditForm(f => ({ ...f, menu_price_min: e.target.value }))} />
                  <input type="number" className="input-field" value={editForm.menu_price_max} onChange={e => setEditForm(f => ({ ...f, menu_price_max: e.target.value }))} />
                </div>
                <textarea className="input-field resize-none" rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(r.id)} className="btn-primary text-xs py-2 px-5">Save</button>
                  <button onClick={() => setEditingId(null)} className="btn-outline text-xs py-2 px-5">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-sans font-semibold text-cream">{r.name}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-cream/40 text-xs">{r.table_count || 0} tables booked</span>
                    <button onClick={() => startEdit(r)} className="text-gold text-xs hover:text-yellow transition-colors">Edit</button>
                  </div>
                </div>
                <p className="font-sans text-cream/60 text-sm mb-2">{r.address}</p>
                <div className="flex flex-wrap gap-3 text-xs font-sans text-cream/50">
                  <span>Time: {r.bookingTime}</span>
                  <span>Menu: ${r.menuPriceMin}–${r.menuPriceMax}</span>
                  <span>Capacity: {r.capacity}</span>
                </div>
                {r.notes && <p className="font-sans text-cream/40 text-xs mt-2 italic">{r.notes}</p>}
              </>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
