import { useEffect, useRef, useState } from 'react';

/**
 * Fetch url as JSON immediately, then re-fetch every intervalMs (0 = once).
 * onData(data, isInitial) on each success; poll errors are silent, the
 * initial error lands in `error`. No-op when url is falsy — callers pass null
 * for a collapsed card so a card nobody is looking at costs no requests.
 *
 * Requests are also suspended while the tab is hidden: a backgrounded tab does
 * nothing until it comes back, then catches up with one immediate fetch.
 */
export function usePolledJSON(url, intervalMs, onData) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cb = useRef(onData);
  cb.current = onData;
  useEffect(() => {
    if (!url) {
      setLoading(false);
      setError(null);
      return undefined;
    }
    let alive = true;
    let firstRequest = true;
    let controller = null;
    let timer = null;
    let pending = false;

    const load = () => {
      if (pending) return;
      clearTimeout(timer);
      // Hidden tabs wait for visibilitychange instead of leaving a timer armed.
      if (document.hidden) return;
      pending = true;
      const requestController = new AbortController();
      controller = requestController;
      const isInitial = firstRequest;
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      // Live presence endpoints often advertise a short public max-age. The
      // no-store request makes a regular reload and each poll ask the network
      // for the latest response instead of replaying the browser cache.
      const timeout = setTimeout(() => requestController.abort(), 15000);
      fetch(url, { cache: 'no-store', signal: requestController.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`request failed (${response.status})`);
          return response.json();
        })
        .then((data) => {
          if (!alive || requestController.signal.aborted) return;
          cb.current(data, isInitial);
          firstRequest = false;
          if (isInitial) setLoading(false);
          setError(null);
        })
        .catch((err) => {
          if (!alive) return;
          if (isInitial) {
            setError(err.name === 'AbortError' ? 'Request timed out' : String(err));
            setLoading(false);
          }
        })
        .finally(() => {
          clearTimeout(timeout);
          pending = false;
          if (alive && intervalMs > 0 && !document.hidden) timer = setTimeout(load, intervalMs);
        });
    };

    load();
    const resume = () => {
      if (document.hidden) {
        clearTimeout(timer);
        return;
      }
      // A one-shot fetch that already succeeded has nothing to catch up on.
      if (intervalMs > 0 || firstRequest) load();
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      controller?.abort();
    };
  }, [url, intervalMs]);
  return { loading, error };
}
