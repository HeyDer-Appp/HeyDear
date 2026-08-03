import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
import api from '../../utils/api';

function TypeBadge({ type }) {
  const map = {
    prompt: { label: 'Prompt', cls: 'bg-purple-500/15 text-purple-300' },
    answer: { label: 'Answer', cls: 'bg-blue-500/15 text-blue-300' },
    text: { label: 'Message', cls: 'bg-gold/15 text-gold' },
  };
  const cfg = map[type] || { label: type, cls: 'bg-white/10 text-cream/60' };
  return <span className={`text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

export default function AdminContent() {
  const [searchParams] = useSearchParams();
  const [dinners, setDinners] = useState([]);
  const [selectedDinner, setSelectedDinner] = useState(searchParams.get('dinner') || '');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('photos');
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
    setMessages([]);
    api.get(`/admin/content/tables/${selectedDinner}`)
      .then(r => setTables(r.data.tables || []))
      .catch(console.error);
  }, [selectedDinner]);

  const openTable = async (tableId) => {
    setSelectedTable(tableId);
    setLoading(true);
    try {
      const [p, m] = await Promise.all([
        api.get(`/admin/content/tables/${tableId}/photos`),
        api.get(`/admin/content/tables/${tableId}/messages`),
      ]);
      setPhotos(p.data.photos || []);
      setMessages(m.data.messages || []);
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

  const deleteMessage = async (messageId) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/content/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete message'); }
  };

  return (
    <AdminLayout title="Album & Group Chat">
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
                  {new Date(d.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
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
                <p className="font-sans text-cream/40 text-xs mt-0.5">{t.member_count} people · {t.photo_count} photos · {t.message_count} messages</p>
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            {!selectedTable ? (
              <div className="card text-center py-16">
                <p className="text-cream/40 text-sm">Select a table to review its album and group chat.</p>
              </div>
            ) : (
              <div className="card">
                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => setTab('photos')}
                    className={`px-4 py-2 rounded-lg text-sm font-sans transition-all ${tab === 'photos' ? 'bg-gold/15 text-gold' : 'text-cream/50 hover:text-cream'}`}
                  >
                    Photos ({photos.length})
                  </button>
                  <button
                    onClick={() => setTab('messages')}
                    className={`px-4 py-2 rounded-lg text-sm font-sans transition-all ${tab === 'messages' ? 'bg-gold/15 text-gold' : 'text-cream/50 hover:text-cream'}`}
                  >
                    Group chat ({messages.length})
                  </button>
                </div>

                {loading && <p className="text-cream/40 text-sm text-center py-8">Loading...</p>}

                {!loading && tab === 'photos' && (
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

                {!loading && tab === 'messages' && (
                  messages.length === 0 ? (
                    <p className="text-cream/25 text-xs text-center py-8">No messages yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {messages.map(m => (
                        <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-navy/40 border border-white/5 group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-sans text-cream text-xs font-semibold">{m.user_name}</span>
                              <TypeBadge type={m.type} />
                              <span className="font-sans text-cream/25 text-[10px]">
                                {m.created_at ? new Date(m.created_at).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            {m.prompt_text && <p className="font-sans text-cream/50 text-xs italic mb-0.5">"{m.prompt_text}"</p>}
                            {m.option && <p className="font-sans text-cream/80 text-sm">→ {m.option}</p>}
                            {m.text && <p className="font-sans text-cream/80 text-sm">{m.text}</p>}
                          </div>
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="text-cream/20 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Delete message"
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
