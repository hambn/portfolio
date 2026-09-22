// Anchor to elapsed time, not interval ticks: suspended tabs cannot slow the clock.
export function playbackProgress(sample, now) {
  if (!sample?.status?.item) return 0;
  const { status, receivedAt, latency = 0 } = sample;
  const elapsed = status.is_playing ? Math.max(0, now - receivedAt) + latency : 0;
  return Math.min(status.item.duration_ms || 0, Math.max(0, status.progress_ms || 0) + elapsed);
}
