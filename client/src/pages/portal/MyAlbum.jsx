import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

// A dinner's whole photo set, shown as one physical-looking pile — the last
// few photos fanned out with a slight rotation — that opens into the full
// set when tapped. No card, no date/city text: the polaroid itself already
// carries the date, and the city shows once expanded.
function PhotoStack({ photos, dateLabel, onOpen }) {
  const stacked = photos.slice(-MAX_STACK);
  return (
    <button type="button" onClick={onOpen} className="relative block w-full max-w-[128px] aspect-square mx-auto">
      {stacked.map((p, i) => {
        const rotate = (i - (stacked.length - 1) / 2) * 6;
        const y = (stacked.length - 1 - i) * 2;
        return (
          <div
            key={p.id}
            className="absolute inset-0"
            style={{ transform: `rotate(${rotate}deg) translateY(${y}px)`, zIndex: i }}
          >
            <PolaroidCard photo={p} dateLabel={dateLabel} />
          </div>
        );
      })}
      {photos.length > 1 && (
        <span className="absolute -top-2 -right-2 z-10 bg-gold text-navy text-[10px] font-sans font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          {photos.length}
        </span>
      )}
    </button>
  );
}

export default function MyAlbum() {
  const [dinners, setDinners] = useState([]);
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [openDinnerId, setOpenDinnerId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/album'),
      api.get('/portal/profile').catch(() => null),
    ]).then(([album, profile]) => {
      setDinners(album.data.dinners || []);
      setFirstName(profile?.data?.user?.first_name || '');
    }).catch(() => toast.error('Could not load your album'))
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

  const openDinner = dinners.find(d => d.table_id === openDinnerId);
  const openDinnerDateLabel = openDinner ? formatDinnerDate(openDinner.date) : '';

  return (
    <div className="quiz-bg min-h-screen relative overflow-hidden pb-24">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] backdrop-blur">
        <Link to="/portal/dashboard" className="font-sans text-cream/50 text-sm hover:text-cream transition-colors">← Back</Link>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7" />
        <div className="w-10" />
      </nav>

      <div className="relative z-10 max-w-lg mx-auto px-5 py-8">
        <div className="mb-6">
          <p className="font-sans text-cream/40 text-sm">Your dinners</p>
          <h1 className="font-serif text-3xl text-cream mt-1">My Album</h1>
          <p className="font-sans text-cream/40 text-sm mt-2 leading-relaxed">
            Tap a stack to view {firstName ? `${firstName}'s` : 'your'} memories.
          </p>
        </div>

        {dinners.length === 0 && (
          <div className="quiz-card text-center py-10">
            <p className="font-sans text-cream/50 text-sm">
              No dinners yet — once you're matched and Tuesday night happens, photos from the table show up here.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 items-start">
          {dinners.map(dinner => {
            const dateLabel = formatDinnerDate(dinner.date);
            return (
              <div key={dinner.table_id} className="flex flex-col items-center">
                {dinner.photos.length === 0 ? (
                  <div className="w-full max-w-[128px] aspect-square flex flex-col items-center justify-center text-center">
                    <p className="font-sans text-cream/30 text-xs">{dateLabel}</p>
                    <p className="font-sans text-cream/30 text-xs italic mt-1">No photos yet.</p>
                  </div>
                ) : (
                  <PhotoStack photos={dinner.photos} dateLabel={dateLabel} onOpen={() => setOpenDinnerId(dinner.table_id)} />
                )}

                {dinner.can_upload && (
                  <div className="flex gap-1.5 mt-2 w-full max-w-[128px]">
                    <label className={`quiz-cta flex-1 text-[11px] py-2 flex items-center justify-center gap-1 cursor-pointer ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploadingFor === dinner.table_id ? '…' : '📷'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => handleUpload(dinner.table_id, e.target.files?.[0])}
                      />
                    </label>
                    <label className={`flex-1 text-[11px] py-2 rounded-2xl border border-white/15 text-cream/70 flex items-center justify-center gap-1 cursor-pointer hover:border-gold/40 transition-colors ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                      🖼
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleUpload(dinner.table_id, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded stack — every photo from this one dinner, scattering into
          place from roughly where the stack sat when tapped. */}
      <AnimatePresence>
        {openDinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => setOpenDinnerId(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-lg bg-[#16181d] rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 pb-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-serif text-xl text-cream">{openDinnerDateLabel}</p>
                  <p className="font-sans text-cream/35 text-xs">{openDinner.city}</p>
                </div>
                <button
                  onClick={() => setOpenDinnerId(null)}
                  className="font-sans text-cream/40 hover:text-cream text-xs transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {openDinner.photos.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{
                      opacity: 0,
                      scale: 0.4,
                      rotate: (i % 2 === 0 ? -1 : 1) * (16 + (i % 3) * 6),
                      x: (i % 2 === 0 ? -1 : 1) * 24,
                      y: -16,
                    }}
                    animate={{ opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.06 }}
                  >
                    <PolaroidCard photo={p} dateLabel={openDinnerDateLabel} />
                    {p.uploaderName && (
                      <p className="font-sans text-cream/25 text-[10px] text-center mt-1">by {p.uploaderName}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
