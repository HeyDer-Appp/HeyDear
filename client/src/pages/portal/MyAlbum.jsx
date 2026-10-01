import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { fileToDataUrl, cropAndResizeImage } from '../../utils/image';
import BottomNav from '../../components/BottomNav';
import ProfileAvatar from '../../components/ProfileAvatar';
import { Stagger, Rise } from '../../components/Motion';
import PhotoCropModal from '../../components/PhotoCropModal';
import { useCachedFetch } from '../../utils/useCachedFetch';

const MAX_STACK = 3;

function formatDinnerDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

// A single printed-photo card — the date is burned in at the bottom in a
// handwritten style so, months later, someone can tell at a glance which
// Tuesday a picture is from without reading anything else on the page.
function PolaroidCard({ photo, dateLabel, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#f5edd8] rounded-sm p-2 shadow-[0_10px_28px_rgba(0,0,0,0.5)] select-none transition-transform duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.04] hover:shadow-[0_14px_36px_rgba(0,0,0,0.6)]' : ''}`}
    >
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
    // aspect-[4/5], not aspect-square: the polaroid card itself (padding +
    // square image + date line) is taller than it is wide, so a plain
    // square box was too short — the card's bottom (including the date
    // text) spilled out past it and sat on top of the buttons below.
    <button type="button" onClick={onOpen} className="relative block w-full max-w-[104px] aspect-[4/5] mx-auto">
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
        <span className="absolute -top-2 -right-2 z-10 bg-plum text-cream text-[10px] font-sans font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          {photos.length}
        </span>
      )}
    </button>
  );
}

export default function MyAlbum() {
  const { attendeeUser } = useAuth();
  const [uploadingFor, setUploadingFor] = useState(null);
  const [openDinnerId, setOpenDinnerId] = useState(null);
  const [openPhotoIndex, setOpenPhotoIndex] = useState(null);
  const [cropTarget, setCropTarget] = useState(null);

  const { data: albumData, loading, error, setData: setAlbumData } = useCachedFetch('portal_album', async () => {
    const [album, profile] = await Promise.all([
      api.get('/album'),
      api.get('/portal/profile').catch(() => null),
    ]);
    return { dinners: album.data.dinners || [], firstName: profile?.data?.user?.first_name || '' };
  });
  const dinners = albumData?.dinners ?? [];
  const firstName = albumData?.firstName ?? '';

  useEffect(() => {
    if (error) toast.error('Could not load your album');
  }, [error]);

  // Picking a file just opens the crop step for that dinner — the actual
  // resize/upload happens in handleCropConfirm once a crop's chosen.
  const handleFileSelect = async (tableId, file) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setCropTarget({ tableId, src: dataUrl });
    } catch (err) {
      toast.error(err.message || 'Could not use that photo.');
    }
  };

  const handleCropConfirm = async (croppedAreaPixels) => {
    const { tableId, src } = cropTarget;
    setUploadingFor(tableId);
    try {
      const dataUrl = await cropAndResizeImage(src, croppedAreaPixels, { maxSize: 900, quality: 0.75 });
      const res = await api.post(`/album/${tableId}/photos`, { photo: dataUrl });
      setAlbumData(prev => ({
        ...prev,
        dinners: prev.dinners.map(d => d.table_id === tableId ? { ...d, photos: [...d.photos, res.data.photo] } : d),
      }));
      toast.success('Photo added to the album!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not upload that photo.');
    } finally {
      setUploadingFor(null);
      setCropTarget(null);
    }
  };

  const handleDeletePhoto = async (tableId, photoId) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
      await api.delete(`/album/${tableId}/photos/${photoId}`);
      setAlbumData(prev => ({
        ...prev,
        dinners: prev.dinners.map(d => d.table_id === tableId ? { ...d, photos: d.photos.filter(p => p.id !== photoId) } : d),
      }));
      setOpenPhotoIndex(null);
      toast.success('Photo deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete that photo.');
    }
  };

  if (loading) {
    return (
      <div className="portal-bg no-map min-h-screen relative overflow-hidden pb-24">
        <nav
          className="relative z-10 flex items-center justify-between px-6 pb-5 backdrop-blur-md"
          style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
        >
          <Link to="/portal/dashboard" className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
          <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
          <ProfileAvatar />
        </nav>
        <div className="relative z-10 max-w-lg mx-auto px-5 py-8">
          <h1 className="font-serif font-bold text-3xl text-navy mb-6">Album</h1>
          <div className="grid grid-cols-2 gap-5 animate-pulse">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-full max-w-[104px] aspect-square rounded-sm bg-white/40" />
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const openDinner = dinners.find(d => d.table_id === openDinnerId);
  const openDinnerDateLabel = openDinner ? formatDinnerDate(openDinner.date) : '';
  const openPhoto = openDinner && openPhotoIndex !== null ? openDinner.photos[openPhotoIndex] : null;

  return (
    <div className="portal-bg no-map min-h-screen relative overflow-hidden pb-24">
      <nav
        className="relative z-10 flex items-center justify-between px-6 pb-5 backdrop-blur-md"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <Link to="/portal/dashboard" className="font-sans text-navy/65 text-sm hover:text-navy transition-colors">← Back</Link>
        <img src="https://heyder.nz/wp-content/uploads/2026/04/logo1.png" alt="HeyDer" className="h-7 brightness-0" />
        <ProfileAvatar />
      </nav>

      <Stagger className="relative z-10 max-w-lg mx-auto px-5 py-8">
        <Rise><h1 className="font-serif font-bold text-3xl text-navy mb-6">Album</h1></Rise>

        <div className="album-frame">
        {dinners.length === 0 && (
          <p className="font-sans text-navy/55 text-sm text-center pt-24">No dinners yet.</p>
        )}

        <div className="grid grid-cols-2 gap-x-5 gap-y-9 items-start">
          {dinners.map(dinner => {
            const dateLabel = formatDinnerDate(dinner.date);
            return (
              <Rise key={dinner.table_id} className="flex flex-col items-center">
                {dinner.photos.length === 0 ? (
                  <div className="w-full max-w-[104px] aspect-square flex flex-col items-center justify-center text-center">
                    <p className="font-sans text-navy/45 text-xs">{dateLabel}</p>
                    <p className="font-sans text-navy/45 text-xs italic mt-1">Empty</p>
                  </div>
                ) : (
                  <PhotoStack photos={dinner.photos} dateLabel={dateLabel} onOpen={() => setOpenDinnerId(dinner.table_id)} />
                )}

                {dinner.can_upload && (
                  // relative + z-20: the fanned, rotated polaroids above are
                  // position:absolute and their corners spill outside the
                  // stack's own square — without this they render on top of
                  // (and swallow clicks meant for) these buttons underneath.
                  // White/cream background (not transparent) so both read as
                  // real buttons sitting under the polaroid, not stray icons.
                  <div className="relative z-20 flex gap-1.5 mt-2.5 w-full max-w-[104px]">
                    <label className={`flex-1 bg-cream text-[#2a2a2a] rounded-lg text-base py-2 flex items-center justify-center cursor-pointer shadow-[0_2px_8px_rgba(22,24,29,0.2)] hover:bg-white transition-colors ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploadingFor === dinner.table_id ? '…' : '📷'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => { handleFileSelect(dinner.table_id, e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                    <label className={`flex-1 bg-cream text-[#2a2a2a] rounded-lg text-base py-2 flex items-center justify-center cursor-pointer shadow-[0_2px_8px_rgba(22,24,29,0.2)] hover:bg-white transition-colors ${uploadingFor === dinner.table_id ? 'opacity-60 pointer-events-none' : ''}`}>
                      🖼
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { handleFileSelect(dinner.table_id, e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                  </div>
                )}
              </Rise>
            );
          })}
        </div>
        </div>
      </Stagger>

      {/* Expanded stack — every photo from this one dinner, scattering into
          place from roughly where the stack sat when tapped. */}
      <AnimatePresence>
        {openDinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
            onClick={() => { setOpenDinnerId(null); setOpenPhotoIndex(null); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-lg bg-cream rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 pb-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-serif text-xl text-navy">{openDinnerDateLabel}</p>
                  <p className="font-sans text-navy/50 text-xs">{openDinner.city}</p>
                </div>
                <button
                  onClick={() => { setOpenDinnerId(null); setOpenPhotoIndex(null); }}
                  className="font-sans text-navy/55 hover:text-navy text-xs transition-colors"
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
                    <PolaroidCard photo={p} dateLabel={openDinnerDateLabel} onClick={() => setOpenPhotoIndex(i)} />
                    {p.uploaderName && (
                      <p className="font-sans text-navy/40 text-[10px] text-center mt-1">by {p.uploaderName}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual photo view — tapping a polaroid in the expanded stack
          opens it full-size, with left/right through the rest of that
          dinner's photos. */}
      <AnimatePresence>
        {openPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 px-4"
            onClick={() => setOpenPhotoIndex(null)}
          >
            <div className="absolute top-5 right-5 flex items-center gap-4">
              {openPhoto.userId === attendeeUser?.uid && (
                <button
                  onClick={e => { e.stopPropagation(); handleDeletePhoto(openDinner.table_id, openPhoto.id); }}
                  className="font-sans text-red-700/70 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setOpenPhotoIndex(null)}
                className="font-sans text-navy/72 hover:text-navy text-sm"
              >
                Close ✕
              </button>
            </div>

            {openDinner.photos.length > 1 && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setOpenPhotoIndex(i => (i - 1 + openDinner.photos.length) % openDinner.photos.length); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/65 hover:text-navy text-3xl font-serif px-2"
                >
                  ‹
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setOpenPhotoIndex(i => (i + 1) % openDinner.photos.length); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/65 hover:text-navy text-3xl font-serif px-2"
                >
                  ›
                </button>
              </>
            )}

            <div
              className="bg-[#f5edd8] rounded-sm p-3 shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-full select-none"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={openPhoto.photo}
                alt=""
                className="max-w-full object-contain rounded-[1px]"
                style={{ maxHeight: '65vh' }}
                draggable={false}
              />
              <p
                className="text-center text-[#2a2a2a] text-lg leading-none mt-2.5 mb-0.5"
                style={{ fontFamily: "'Permanent Marker', cursive" }}
              >
                {openDinnerDateLabel}
              </p>
            </div>
            {openPhoto.uploaderName && (
              <p className="font-sans text-navy/55 text-xs mt-3">by {openPhoto.uploaderName}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {cropTarget && (
        <PhotoCropModal imageSrc={cropTarget.src} cropShape="rect" onConfirm={handleCropConfirm} onCancel={() => setCropTarget(null)} />
      )}

      <BottomNav />
    </div>
  );
}
