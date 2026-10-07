// Thin localStorage wrapper for useCachedFetch — wrapped in try/catch since
// localStorage can throw (private browsing, storage full, disabled) and a
// cache miss should just mean "fetch normally," never a hard failure.
const PREFIX = 'heyder_cache_';

export function getCached(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// When an entry was last written, so a screen mounted a moment after another
// one fetched the same data (a swipe's live preview, then the real screen) can
// reuse it instead of asking the server again.
export function cachedAgeMs(key) {
  try {
    const at = Number(localStorage.getItem(PREFIX + 'at_' + key));
    return at ? Date.now() - at : Infinity;
  } catch {
    return Infinity;
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
    localStorage.setItem(PREFIX + 'at_' + key, String(Date.now()));
  } catch {
    // ignore — cache is a nice-to-have, not required for the app to work
  }
}

export function clearCached(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// Wipes every cached key at once — used on sign-out so a different account
// logging in on the same device (shared/test devices, common during beta
// testing) never briefly sees the previous person's cached profile,
// dinners, etc. before its own fetch replaces it.
export function clearAllCached() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
