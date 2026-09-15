import { useEffect, useState } from 'react';
import { playbackProgress } from './playbackClock.js';

const POLL_MS = 3000;
const LIBRARY_MS = 60000;

export function useSpotifyPlayback(endpoint) {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!endpoint) return;
    let disposed = false;
    let controller;
    let timer;
    let busy = false;
    let sample;
    let library;
    let libraryAt = -Infinity;
    let failures = 0;
    let retryAt = 0;
    let refreshLibrary = false;
    const playbackUrl = new URL(endpoint, window.location.href);
    playbackUrl.searchParams.set('playback', '1');

    async function poll() {
      clearTimeout(timer);
      if (disposed || busy || document.hidden) return;
      if (Date.now() < retryAt) {
        timer = setTimeout(poll, retryAt - Date.now());
        return;
      }
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const full = !library || refreshLibrary || performance.now() - libraryAt >= LIBRARY_MS;
      let delay = POLL_MS;
      try {
        const started = performance.now();
        const response = await fetch(full ? endpoint : playbackUrl.href, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retry = response.headers.get('Retry-After');
            const seconds = Number(retry);
            retryAt =
              Number.isFinite(seconds) && seconds > 0
                ? Date.now() + seconds * 1000
                : Math.max(Date.now() + 30000, Date.parse(retry) || 0);
          }
          throw new Error(`Spotify request failed (${response.status})`);
        }
        const result = await response.json();
        if (result.error || !Object.hasOwn(result, 'status'))
          throw new Error('Invalid Spotify response');
        if (disposed) return;
        const now = performance.now();
        const incoming = result.status || { is_playing: false, item: null };
        if (incoming.error) throw new Error('Spotify playback unavailable');
        const previous = sample?.status;
        const contextChanged = previous?.context?.uri !== incoming.context?.uri;
        const trackChanged = previous?.item?.id !== incoming.item?.id;
        if (!result.playbackOnly) {
          library = result;
          libraryAt = now;
          refreshLibrary = false;
        } else if (contextChanged || trackChanged) {
          refreshLibrary = true;
        }
        // Library requests may have captured playback seconds earlier. Keep the
        // existing clock until the immediate playback-only check completes.
        if (full && sample) {
          if (sample.status.context?.uri === incoming.context?.uri) {
            sample = {
              ...sample,
              status: { ...sample.status, contextPlaylist: incoming.contextPlaylist },
            };
          }
          setData({ ...library, status: sample.status });
          setLoading(false);
          setError(null);
          failures = 0;
          delay = 0;
          return;
        }
        const contextPlaylist =
          incoming.contextPlaylist ||
          (incoming.context?.uri && incoming.context.uri === library?.status?.context?.uri
            ? library.status.contextPlaylist
            : null);
        const status = { ...incoming, contextPlaylist };
        // Only the small playback response has a useful round-trip latency estimate.
        sample = {
          status,
          receivedAt: now,
          latency: result.playbackOnly ? Math.min(1000, (now - started) / 2) : 0,
        };
        setData({ ...library, status });
        setProgress(playbackProgress(sample, now));
        setLoading(false);
        setError(null);
        failures = 0;
        // Recheck shortly after the expected end instead of sitting on a full bar.
        const remaining = (status.item?.duration_ms || 0) - playbackProgress(sample, now);
        if (status.is_playing && remaining > 0)
          delay = Math.max(500, Math.min(POLL_MS, remaining + 150));
        if (full) delay = 0; // Get a fresh clock after slower profile/library work.
      } catch (err) {
        if (!disposed) {
          failures += 1;
          delay = Math.min(30000, POLL_MS * 2 ** Math.min(failures, 4));
          retryAt = Math.max(retryAt, Date.now() + delay);
          setLoading(false);
          setError(err);
        }
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed && !document.hidden)
          timer = setTimeout(poll, Math.max(delay, retryAt - Date.now()));
      }
    }
    function resume() {
      if (document.hidden) clearTimeout(timer);
      else void poll();
    }
    // Stop extrapolating a stale response after a connection failure.
    const clock = setInterval(() => {
      if (!document.hidden && sample) {
        setProgress(
          playbackProgress(sample, Math.min(performance.now(), sample.receivedAt + 15000)),
        );
      }
    }, 250);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    setData(null);
    setLoading(true);
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(clock);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
    };
  }, [endpoint]);

  return { data, progress, loading, error };
}
