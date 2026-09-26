import { Capacitor } from '@capacitor/core';

// Touch feedback. In the installed app this uses the phone's proper haptic
// engine (Capacitor Haptics — soft, crisp ticks rather than a motor buzz).
// In a browser, or in an app build that predates the plugin, it falls back
// to the Vibration API with very short pulses, and quietly does nothing
// where neither exists (iOS Safari, desktop). Can be switched off from the
// profile settings menu.

const KEY = 'heyder_haptics';
let mod = null;

function loadPlugin() {
  if (mod || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Haptics')) return;
  import('@capacitor/haptics').then((m) => { mod = m; }).catch(() => {});
}
loadPlugin();

export function hapticsEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setHapticsEnabled(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}

let lastAt = 0;
function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
// A slider drag or a fast double-tap must not turn into a continuous buzz.
function throttled(minGap) {
  const now = Date.now();
  if (now - lastAt < minGap) return true;
  lastAt = now;
  return false;
}

export function tap() {
  if (!hapticsEnabled() || throttled(35)) return;
  if (mod) mod.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
  else vibrate(8);
}

// One notch of a slider / picker.
export function tick() {
  if (!hapticsEnabled() || throttled(30)) return;
  // Impact rather than selectionChanged: on Android the latter is too faint to
  // feel while a finger is moving. 14ms is about the shortest buzz a phone
  // motor actually produces.
  if (mod) mod.Haptics.impact({ style: mod.ImpactStyle.Light }).catch(() => {});
  else vibrate(14);
}

export function medium() {
  if (!hapticsEnabled() || throttled(35)) return;
  if (mod) mod.Haptics.impact({ style: mod.ImpactStyle.Medium }).catch(() => {});
  else vibrate(16);
}

export function success() {
  if (!hapticsEnabled()) return;
  if (mod) mod.Haptics.notification({ type: mod.NotificationType.Success }).catch(() => {});
  else vibrate([12, 60, 18]);
}

export function warning() {
  if (!hapticsEnabled()) return;
  if (mod) mod.Haptics.notification({ type: mod.NotificationType.Warning }).catch(() => {});
  else vibrate([30, 50, 30]);
}

export function error() {
  if (!hapticsEnabled()) return;
  if (mod) mod.Haptics.notification({ type: mod.NotificationType.Error }).catch(() => {});
  else vibrate([40, 60, 40, 60, 40]);
}

// Every button, link, dropdown and toggle gets a light tap — installed once
// for the whole app instead of wiring each control by hand.
const TAPPABLE = 'button, a[href], [role="button"], summary, select, label[for], input[type="checkbox"], input[type="radio"], .cursor-pointer';

export function installGlobalHaptics() {
  if (typeof document === 'undefined') return;
  document.addEventListener('click', (e) => {
    const el = e.target?.closest?.(TAPPABLE);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-no-haptic]')) return;
    tap();
  }, { capture: true, passive: true });
}
