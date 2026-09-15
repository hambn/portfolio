import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../api/index.js';
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

test('lightweight API only fetches playback, handles no playback and propagates rate limits', async (t) => {
  const calls = [];
  const deleted = [];
  const env = {
    SPOTIFY_KV: { get: async () => 'test-access-token', delete: async (key) => deleted.push(key) },
  };
  let upstream = Response.json(playing);
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return upstream.clone();
  });
  const request = () => worker.fetch(new Request('https://example.test/spotify?playback=1'), env);
  let response = await request();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: playing, playbackOnly: true });
  assert.deepEqual(calls, ['https://api.spotify.com/v1/me/player/currently-playing']);
  upstream = new Response(null, { status: 204 });
  response = await request();
  assert.deepEqual((await response.json()).status, { is_playing: false, item: null });
  upstream = new Response(null, { status: 429, headers: { 'Retry-After': '17' } });
  response = await request();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '17');
  assert.equal(response.headers.get('Access-Control-Expose-Headers'), 'Retry-After');
  upstream = new Response(null, { status: 401 });
  response = await request();
  assert.equal(response.status, 401);
  assert.deepEqual(deleted, ['access_token']);
});
