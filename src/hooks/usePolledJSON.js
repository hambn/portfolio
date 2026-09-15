import { useEffect, useRef, useState } from 'react';

/**
 * Fetch url as JSON immediately, then re-fetch every intervalMs (0 = once).
 * onData(data, isInitial) on each success; poll errors are silent, the
 * initial error lands in `error`. No-op when url is falsy.
 */
export function usePolledJSON(url, intervalMs, onData) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cb = useRef(onData);
  cb.current = onData;
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    fetch(url).then(r => r.json())
      .then(d => { if (!alive) return; cb.current(d, true); setLoading(false); })
      .catch(e => { if (!alive) return; setError(String(e)); setLoading(false); });
    const id = intervalMs > 0 ? setInterval(() => {
      fetch(url).then(r => r.json()).then(d => { if (alive) cb.current(d, false); }).catch(() => {});
    }, intervalMs) : null;
    return () => { alive = false; if (id) clearInterval(id); };
  }, [url, intervalMs]);
  return { loading, error };
}
