import React, { useEffect, useState } from 'react';
import { isPushSupported, getPermissionState, subscribeToPush } from '../utils/push';

export default function PushPrompt({ userId, onDismiss }) {
  const [state, setState] = useState('idle'); // idle | asking | granted | denied | unsupported
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setState('unsupported'); return; }
    const perm = getPermissionState();
    if (perm === 'granted') { setState('granted'); return; }
    if (perm === 'denied') { setState('denied'); return; }
    // Show prompt after a short delay so it doesn't feel jarring
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const handleEnable = async () => {
    setState('asking');
    const result = await subscribeToPush(userId);
    if (result.success) {
      setState('granted');
      setTimeout(() => { setVisible(false); onDismiss?.(); }, 2000);
    } else if (result.error === 'denied') {
      setState('denied');
    } else {
      setState('idle');
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
    // Don't ask again for 7 days
    localStorage.setItem('heyder_push_dismissed', Date.now().toString());
  };

  // Don't show if recently dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem('heyder_push_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      setVisible(false);
    }
  }, []);

  if (!visible || state === 'unsupported' || state === 'granted') return null;

  return (
    <div className={`fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 transition-all duration-500 ${
      visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
    }`}>
      <div className="glass-card !bg-cream border-plum/20">
        {state === 'granted' ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-plum/15 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#754471" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <p className="font-sans font-semibold text-navy text-sm">Notifications on</p>
            </div>
          </div>
        ) : state === 'denied' ? (
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">🔔</span>
            <div>
              <p className="font-sans font-semibold text-navy text-sm mb-1">Notifications blocked</p>
              <p className="font-sans text-navy/65 text-xs">Enable them in settings.</p>
              <button onClick={handleDismiss} className="font-sans text-navy/55 text-xs mt-2 hover:text-navy transition-colors">Dismiss</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-plum/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🔔</span>
              </div>
              <div>
                <p className="font-sans font-semibold text-navy text-sm leading-snug">
                  Get notified when your group is ready
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={state === 'asking'}
                className="flex-1 bg-plum text-cream font-sans font-semibold text-xs tracking-widest uppercase py-3 rounded-lg transition-all hover:bg-plum/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {state === 'asking' ? (
                  <><div className="w-3 h-3 border-2 border-cream border-t-transparent rounded-full animate-spin" /></>
                ) : (
                  'Turn on'
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-3 rounded-lg border border-navy/15 text-navy/65 hover:text-navy font-sans text-xs transition-colors"
              >
                Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
