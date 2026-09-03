import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCached } from './cache';

// Stale-while-revalidate: if this key has a cached value, it's shown
// immediately (no loading spinner) while a fresh copy is quietly fetched in
// the background — a page you've already opened once loads instantly on
// every later visit instead of spinner-then-content each time. A first-ever
// visit (nothing cached yet) still shows the normal loading state.
//
// `key` should be unique per distinct dataset (e.g. 'portal_dinners') —
// pass null to skip caching entirely (falls back to a plain fetch-on-mount).
export function useCachedFetch(key, fetcher, deps = []) {
  const cached = key ? getCached(key) : null;
  const [data, setDataState] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await fetcherRef.current();
      setDataState(result);
      setError(false);
      if (key) setCached(key, result);
      return result;
    } catch (err) {
      setError(true);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load({ silent: !!cached }).catch(() => {});
    // Only re-run on key/dep changes, not on every render — `cached` is
    // deliberately read once per mount via the closure above, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  // Lets a component update both what's on screen and the cached copy the
  // instant it makes a local change (RSVP, cancel a booking, delete a
  // photo...), rather than only updating its own in-memory state — without
  // this, the next visit to the page would flash the old cached value again
  // for a moment before the background refetch caught up.
  const setData = useCallback((updater) => {
    setDataState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (key) setCached(key, next);
      return next;
    });
  }, [key]);

  return { data, loading, error, refetch: load, setData };
}
