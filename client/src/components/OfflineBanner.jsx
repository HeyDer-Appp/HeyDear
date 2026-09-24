import React, { useEffect, useState } from 'react';

// A slim bar when the connection drops, so a screen that quietly stops
// updating doesn't just look broken.
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const up = () => { setOnline(true); window.dispatchEvent(new Event('heyder:refresh')); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[70] text-center font-sans text-xs py-1.5" style={{ background: '#754471', color: '#F5EDD8' }}>
      You're offline — showing what we have
    </div>
  );
}
