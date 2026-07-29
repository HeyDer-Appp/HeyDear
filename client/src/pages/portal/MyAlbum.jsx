import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { fileToResizedBase64 } from '../../utils/image';
import BottomNav from '../../components/BottomNav';

const MAX_STACK = 3;

function formatDinnerDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A single printed-photo card — the date is burned in at the bottom in a
// handwritten style so, months later, someone can tell at a glance which
// Tuesday a picture is from without reading anything else on the page.
function PolaroidCard({ photo, dateLabel }) {
  return (
    <div className="bg-[#f5edd8] rounded-sm p-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)] select-none">
      <div className="w-full aspect-square bg-black/20 overflow-hidden">
        <img src={photo.photo} alt="" className="w-full h-full object-cover" draggable={false} />
      </div>
      <p
        className="text-center text-[#2a2a2a] text-base leading-none mt-2 mb-1"
        style={{ fontFamily: "'Permanent Marker', cursive" }}
      >
        {dateLabel}
      </p>
    </div>
  );
}

export default function MyAlbum() {
  const [dinners, setDinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get('/album')
      .then(res => setDinners(res.data.dinners || []))
      .catch(() => toast.error('Could not load your album'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (tableId, file) => {
    if (!file) return;
    setUploadingFor(tableId);
    try {
      const dataUrl = await fileToResizedBase64(file, { maxSize: 900, quality: 0.75 });
      const res = await api.post(`/album/${tableId}/photos`, { photo: dataUrl });
      setDinners(prev => prev.map(d => (
        d.table_id === tableId ? { ...d, photos: [...d.photos, res.data.photo] } : d
      )));
      toast.success('Photo added to the album!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not upload that photo.');
    } finally {
      setUploadingFor(null);
    }
  };

  if (loading) {
    return (
      <div className="quiz-bg min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="font-sans text-cream/40 text-sm">Your dinners</p>
          <h1 className="font-serif text-3xl text-cream mt-1">My Album</h1>
          <p className="font-sans text-cream/40 text-sm mt-2 leading-relaxed">
            A stack of photos for every Tuesday. Tap a stack to spread them out.
          </p>
        </div>

        {dinners.length === 0 && (
          <div className="quiz-card text-center py-10">
            <p className="font-sans text-cream/50 text-sm">
              No dinners yet — once you're matched and Tuesday night happens, photos from the table show up here.
            </p>
          </div>
        )}

        {dinners.map(dinner => {
          const dateLabel = formatDinnerDate(dinner.date);
          const isExpanded = expandedId === dinner.table_id;

          return (
            <div key={dinner.table_id} className="quiz-card">
              <div className="flex items-center justify-between mb-1">
                <p className="font-serif text-xl text-cream">{dateLabel}</p>
                <span className="font-sans text-cream/35 text-xs">{dinner.city}</span>
              </div>
              <p className="font-sans text-cream/40 text-xs mb-5">
                {dinner.attendees.length > 0 ? `With ${dinner.attendees.join(', ')}` : 'Table details unavailable'}
              </p>

              {dinner.can_upload && (
                <div className="flex gap-2 mb-6">
                  <label className={`quiz-cta flex-1 text-xs py-2.5 flex items-center justify-center gap-1.5 cursor-pointer ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                    {uploadingFor === dinner.table_id ? 'Uploading...' : '📷 Take photo'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleUpload(dinner.table_id, e.target.files?.[0])}
                    />
                  </label>
                  <label className={`flex-1 text-xs py-2.5 rounded-2xl border border-white/15 text-cream/70 flex items-center justify-center gap-1.5 cursor-pointer hover:border-gold/40 transition-colors ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                    🖼 Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleUpload(dinner.table_id, e.target.files?.[0])}
                    />
                  </label>
                </div>
              )}

              {dinner.photos.length === 0 ? (
                <p className="font-sans text-cream/30 text-xs italic">No photos yet.</p>
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className={isExpanded ? 'w-full' : 'relative w-32 h-40 cursor-pointer'}
                    onClick={() => !isExpanded && setExpandedId(dinner.table_id)}
                  >
                    {/* display:contents when stacked so these children position
                        relative to the outer box above, not this wrapper */}
                    <div className={isExpanded ? 'flex gap-4 overflow-x-auto pb-2 -mx-1 px-1' : 'contents'}>
                      {dinner.photos.map((p, i) => {
                        const distFromEnd = dinner.photos.length - 1 - i;
                        const inStack = distFromEnd < MAX_STACK;
                        const stackPos = MAX_STACK - 1 - distFromEnd;
                        const stackCount = Math.min(dinner.photos.length, MAX_STACK);
                        return (
                          <motion.div
                            key={p.id}
                            layout
                            // Rotate/y/scale as their own motion values (not a raw
                            // CSS `transform` string) — layout already owns the
                            // transform property for its own FLIP animation, and
                            // a plain string in `style` gets silently dropped
                            // once layout finishes, which is why "stack them back
                            // up" was landing flat with no rotation.
                            animate={{
                              rotate: isExpanded ? 0 : inStack ? (stackPos - (stackCount - 1) / 2) * 8 : 0,
                              y: isExpanded ? 0 : inStack ? (stackCount - 1 - stackPos) * 3 : 0,
                              scale: isExpanded || inStack ? 1 : 0.85,
                              opacity: isExpanded || inStack ? 1 : 0,
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={isExpanded ? 'w-32 flex-shrink-0' : 'absolute inset-0'}
                            style={isExpanded ? undefined : {
                              zIndex: i,
                              pointerEvents: inStack ? 'auto' : 'none',
                            }}
                          >
                            <PolaroidCard photo={p} dateLabel={dateLabel} />
                            {isExpanded && p.uploaderName && (
                              <p className="font-sans text-cream/25 text-[10px] text-center mt-1">by {p.uploaderName}</p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                    {!isExpanded && dinner.photos.length > 1 && (
                      <span className="absolute -top-2 -right-2 z-10 bg-gold text-navy text-[10px] font-sans font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                        {dinner.photos.length}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : dinner.table_id)}
                    className="font-sans text-cream/40 hover:text-cream text-xs mt-3 transition-colors"
                  >
                    {isExpanded ? '← Stack them back up' : 'Tap the stack to see them all'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
