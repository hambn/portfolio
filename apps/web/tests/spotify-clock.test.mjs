import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playbackProgress } from '../src/pages/links/spotify/playbackClock.js';

const playing = { is_playing: true, progress_ms: 10000, item: { id: 'one', duration_ms: 60000 } };

test('clock follows elapsed time after delayed timers, clamps at the end, and respects seeks and pause', () => {
  const sample = { status: playing, receivedAt: 1000, latency: 100 };
  assert.equal(playbackProgress(sample, 1250), 10350);
  assert.equal(playbackProgress(sample, 11000), 20100);
  assert.equal(playbackProgress(sample, 90000), 60000);
  assert.equal(
    playbackProgress({ ...sample, status: { ...playing, is_playing: false } }, 11000),
    10000,
  );
  assert.equal(
    playbackProgress(
      { ...sample, status: { ...playing, progress_ms: 2000 }, receivedAt: 11000 },
      11000,
    ),
    2100,
  );
  assert.equal(playbackProgress({ status: { is_playing: false, item: null } }, 11000), 0);
});
