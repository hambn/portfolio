import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../src/app.js';
import { testServices } from './helpers.js';

const playing = { is_playing: true, progress_ms: 10000, item: { id: 'one', duration_ms: 60000 } };

test('lightweight API only fetches playback, handles no playback and propagates rate limits', async (t) => {
  const calls: unknown[] = [];
  const deleted: string[] = [];
  const services = testServices({
    fetch: (...args) => fetch(...args),
    state: {
      get: async () => 'test-access-token',
      put: async () => {},
      delete: async (key) => {
        deleted.push(key);
      },
    },
  });
  let upstream = Response.json(playing);
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    calls.push(url);
    return upstream.clone();
  });
  const request = () =>
    handleRequest(new Request('https://example.test/spotify?playback=1'), services);
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

test('aggregate response rewrites artwork and persists rotated tokens', async () => {
  const services = testServices();
  services.config.SPOTIFY_CLIENT_ID = 'client';
  services.config.SPOTIFY_REFRESH_TOKEN = 'fallback';
  let exchanges = 0;
  services.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/token')) {
      exchanges++;
      return Response.json({ access_token: 'access', refresh_token: 'rotated' });
    }
    if (url.endsWith('/me'))
      return Response.json({ id: 'owner', images: [{ url: 'https://i.scdn.co/image/profile' }] });
    if (url.includes('/me/playlists'))
      return Response.json({
        items: [
          {
            id: 'mine',
            owner: { id: 'owner' },
            public: true,
            images: [{ url: 'https://i.scdn.co/image/playlist' }],
          },
          { id: 'private', owner: { id: 'owner' }, public: false },
        ],
      });
    if (url.includes('currently-playing')) return new Response(null, { status: 204 });
    return Response.json({ items: [] });
  };
  const request = new Request('https://api.test/api/spotify');
  const data = await (await handleRequest(request, services)).json();
  assert.match(data.profile.images[0].url, /^\/api\/media\/spotify\//);
  assert.equal(data.playlists.length, 1);
  assert.equal(await services.state.get('refresh_token'), 'rotated');
  await handleRequest(request, services);
  assert.equal(exchanges, 1);
});

test('aggregate response survives an unavailable optional Spotify endpoint', async () => {
  const services = testServices();
  services.config.SPOTIFY_CLIENT_ID = 'client';
  services.config.SPOTIFY_REFRESH_TOKEN = 'refresh';
  services.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/token')) return Response.json({ access_token: 'access' });
    if (url.includes('/me/top/tracks'))
      return new Response('<html>temporarily unavailable</html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      });
    if (url.endsWith('/me')) return Response.json({ id: 'owner' });
    if (url.includes('currently-playing')) return new Response(null, { status: 204 });
    return Response.json({ items: [] });
  };

  const response = await handleRequest(new Request('https://api.test/spotify'), services);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.profile.id, 'owner');
  assert.equal(data.topTracks, null);
  assert.deepEqual(data.playlists, []);
});

test('aggregate response clears an expired token when Spotify returns 401', async () => {
  const deleted: string[] = [];
  const services = testServices({
    state: {
      get: async (key) => (key === 'access_token' ? 'expired' : null),
      put: async () => {},
      delete: async (key) => {
        deleted.push(key);
      },
    },
  });
  services.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/me'))
      return new Response(JSON.stringify({ error: 'expired' }), { status: 401 });
    return Response.json({ items: [] });
  };

  const response = await handleRequest(new Request('https://api.test/spotify'), services);
  assert.equal(response.status, 401);
  assert.deepEqual(deleted, ['access_token']);
});
