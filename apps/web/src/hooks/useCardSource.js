import { useEffect, useRef, useState } from 'react';
import { storage } from '../lib/storage.js';
import { usePolledJSON } from './usePolledJSON.js';

const TIMEOUT_MS = 12000;

function stored(key) {
  if (!key) return null;
  try {
    const value = JSON.parse(storage.get(key) || 'null');
    return value && typeof value.at === 'number' && value.data != null ? value : null;
  } catch {
    return null;
  }
}

/**
 * A card's data, from wherever it can be had.
 *
 * `api` is this site's API route for the card, set when links.json gives the
 * card an `apiEndpoint`; `seed` is its slice of the site-wide request. `direct`
 * asks the provider itself from the visitor's browser: `(signal, previous) =>
 * data`. The API is used when configured, and `direct` takes over when it is
 * not, or when it fails. A card with neither answering keeps `data: null` and
 * renders its header and links alone.
 *
 * Direct answers are kept in localStorage under `cacheKey` for `cacheMs`, so
 * a revisit costs the provider nothing (api.github.com allows 60 anonymous
 * requests an hour per address) and a failed request still has something to
 * show. `valid` rejects an answer that is not the card's shape.
 *
 * Returns `{ data, origin, loading }`; `origin` is 'api' or 'direct', which a
 * card needs to know whether its image URLs are already the API's.
 */
export function useCardSource({
  api = null,
  seed,
  direct = null,
  enabled = true,
  intervalMs = 0,
  cacheKey = null,
  cacheMs = 3600 * 1000,
  valid = (data) => data != null,
}) {
  const [state, setState] = useState({ data: null, origin: null });
  const [rejected, setRejected] = useState(false);
  const [directLoading, setDirectLoading] = useState(false);
  const validRef = useRef(valid);
  validRef.current = valid;
  const directRef = useRef(direct);
  directRef.current = direct;

  const { loading, error } = usePolledJSON(
    enabled ? api : null,
    intervalMs,
    (data) => {
      const ok = validRef.current(data);
      setRejected(!ok);
      if (ok) setState({ data, origin: 'api' });
    },
    seed,
  );

  const hasDirect = typeof direct === 'function';
  const useDirect = enabled && hasDirect && (!api || Boolean(error) || rejected);

  useEffect(() => {
    if (!useDirect) return undefined;
    let alive = true;
    let timer = null;
    let controller = null;
    const last = stored(cacheKey);
    // What the last visit had, unless the API already supplied something newer.
    if (last) setState((now) => (now.data ? now : { data: last.data, origin: 'direct' }));

    const load = async (previous) => {
      // A backgrounded tab asks for nothing; it checks again on the next tick.
      if (document.hidden && intervalMs > 0) {
        timer = setTimeout(() => load(previous), intervalMs);
        return;
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let data = null;
      try {
        data = await directRef.current(controller.signal, previous);
      } catch {
        // Rate limited or offline: the card keeps what it has.
      } finally {
        clearTimeout(timeout);
      }
      if (!alive) return;
      setDirectLoading(false);
      if (data != null && validRef.current(data)) {
        setState({ data, origin: 'direct' });
        if (cacheKey) storage.set(cacheKey, JSON.stringify({ at: Date.now(), data }));
        previous = data;
      }
      if (intervalMs > 0) timer = setTimeout(() => load(previous), intervalMs);
    };

    if (last && Date.now() - last.at < cacheMs && intervalMs <= 0) return undefined;
    setDirectLoading(true);
    load(last?.data ?? null);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
      setDirectLoading(false);
    };
  }, [useDirect, cacheKey, cacheMs, intervalMs]);

  return {
    data: state.data,
    origin: state.origin,
    loading: loading || (useDirect && directLoading),
  };
}
