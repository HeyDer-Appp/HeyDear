import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

// Shared crop step between "file picked" and "actually upload it" —
// used by both the profile photo (round crop) and album photos (square
// crop). Zoom/pan happens here; the caller gets back pixel coordinates to
// feed into utils/image.js's cropAndResizeImage.
export default function PhotoCropModal({ imageSrc, cropShape = 'round', onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || processing) return;
    setProcessing(true);
    try {
      await onConfirm(croppedAreaPixels);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col">
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape={cropShape}
          showGrid={cropShape === 'rect'}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="p-5 space-y-4 bg-[#16181d] border-t border-white/[0.06]">
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-full accent-gold"
          aria-label="Zoom"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-cream/70 font-sans text-sm hover:bg-white/[0.04] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className="quiz-cta flex-1 disabled:opacity-60"
          >
            {processing ? 'Saving...' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
