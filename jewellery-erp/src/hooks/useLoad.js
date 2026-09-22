import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../lib/errors';

// Runs an async loader whenever `deps` change; exposes { data, loading, error, reload }.
export function useLoad(fn, deps = [], initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const d = await fnRef.current();
      if (my === seq.current) setData(d);
    } catch (e) {
      if (my === seq.current) setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, loading, error, reload: run, setData };
}
