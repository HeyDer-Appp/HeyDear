import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

// Deliberately no admin view of chat content, group or DM — a message
// count is the only signal exposed (how active a table's chat is), never
// what anyone actually said. Attendees' conversations aren't something
// admin browses.
export default function AdminContent() {
  const [searchParams] = useSearchParams();
  const [dinners, setDinners] = useState([]);
  const [selectedDinner, setSelectedDinner] = useState(searchParams.get('dinner') || '');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/admin/dinners').then(r => {
      setDinners(r.data.dinners || []);
      if (!selectedDinner && r.data.dinners?.length) setSelectedDinner(r.data.dinners[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDinner) return;
    setSelectedTable(null);
    setPhotos([]);
    api.get(`/admin/content/tables/${selectedDinner}`)
      .then(r => setTables(r.data.tables || []))
      .catch(console.error);
  }, [selectedDinner]);

  const openTable = async (tableId) => {
    setSelectedTable(tableId);
    setLoading(true);
    try {
      const p = await api.get(`/admin/content/tables/${tableId}/photos`);
      setPhotos(p.data.photos || []);
    } catch { toast.error('Failed to load table content'); }
    setLoading(false);
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/content/photos/${photoId}`);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Photo deleted');
    } catch { toast.error('Failed to delete photo'); }
  };

  return (
    <AdminLayout title="Album">
      <div className="space-y-6">
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
                  {new Date(d.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' })}
                  {' '}{d.city} ({d.attendee_count || 0} attendees)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-5">
          {/* Tables list */}
          <div className="w-64 flex-shrink-0 space-y-2">
            <p className="font-sans text-cream/40 text-xs uppercase tracking-widest mb-2">Tables</p>
            {tables.length === 0 && <p className="text-cream/25 text-xs">No tables for this dinner yet</p>}
            {tables.map(t => (
              <button
                key={t.id}
                onClick={() => openTable(t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedTable === t.id ? 'border-gold/40 bg-gold/10' : 'border-white/8 bg-dark-card hover:border-gold/20'
                }`}
              >
                <p className="font-sans text-cream text-sm font-semibold">Table {t.table_number || '—'}</p>
                <p className="font-sans text-cream/40 text-xs mt-0.5">{t.member_count} people · {t.photo_count} photos · {t.message_count} chat messages</p>
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            {!selectedTable ? (
              <div className="card text-center py-16">
                <p className="text-cream/40 text-sm">Select a table to review its album.</p>
              </div>
            ) : (
              <div className="card">
                <p className="font-sans font-semibold text-cream text-sm mb-5">Photos ({photos.length})</p>

                {loading && <p className="text-cream/40 text-sm text-center py-8">Loading...</p>}

                {!loading && (
                  photos.length === 0 ? (
                    <p className="text-cream/25 text-xs text-center py-8">No photos uploaded yet</p>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {photos.map(p => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden border border-white/8">
                          <img src={p.photo} alt="" className="w-full aspect-square object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-navy/80 backdrop-blur px-2 py-1.5">
                            <p className="text-cream/70 text-[10px] truncate">{p.uploaderFirstName || 'Unknown'}</p>
                          </div>
                          <button
                            onClick={() => deletePhoto(p.id)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-navy/80 text-cream/70 hover:text-red-400 hover:bg-navy flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
