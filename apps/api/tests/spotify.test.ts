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
          { id: 'no-artwork', owner: { id: 'owner' }, public: true, images: null },
          { id: 'followed', owner: { id: 'someone-else' }, public: true },
        ],
      });
    if (url.includes('currently-playing')) return new Response(null, { status: 204 });
    return Response.json({ items: [] });
  };
  const request = new Request('https://api.test/api/spotify');
  const data = await (await handleRequest(request, services)).json();
  assert.match(data.profile.images[0].url, /^\/api\/media\/spotify\//);
  assert.deepEqual(
    data.playlists.map((playlist: { id: string }) => playlist.id),
    ['mine', 'no-artwork'],
  );
  assert.equal(data.playlists[1].images, null);
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

test('current playlist accepts modern and legacy track counts and proxies artwork', async () => {
  for (const countField of ['items', 'tracks']) {
    const services = testServices();
    await services.state.put('access_token', 'access');
    services.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/currently-playing'))
        return Response.json({
          ...playing,
          context: { type: 'playlist', uri: 'spotify:playlist:current' },
        });
      if (url.pathname === '/v1/playlists/current') {
        assert.equal(
          url.searchParams.get('fields'),
          'id,name,images,external_urls,tracks(total),items(total)',
        );
        return Response.json({
          id: 'current',
          name: 'Current playlist',
          images: [{ url: 'https://i.scdn.co/image/current' }],
          external_urls: { spotify: 'https://open.spotify.com/playlist/current' },
          [countField]: { total: 359 },
        });
      }
      return Response.json({ items: [] });
    };
    const response = await handleRequest(new Request('https://api.test/spotify'), services);
    assert.equal(response.status, 200);
    const { status } = await response.json();
    assert.equal(status.contextPlaylist.name, 'Current playlist');
    assert.equal(status.contextPlaylist.totalTracks, 359);
    assert.equal(status.contextPlaylist.url, 'https://open.spotify.com/playlist/current');
    assert.match(status.contextPlaylist.images[0].url, /^https:\/\/api.test\/media\/spotify\//);
  }
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

test('concurrent requests share one token refresh and refusals stay generic', async () => {
  let refreshes = 0;
  let refuse = false;
  const services = testServices({
    fetch: async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://accounts.spotify.com/api/token') {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return refuse
          ? Response.json({ error: 'invalid_grant', error_description: 'Refresh token revoked' })
          : Response.json({ access_token: 'access', refresh_token: 'rotated' });
      }
      return Response.json(playing);
    },
  });
  services.config.SPOTIFY_CLIENT_ID = 'client';
  services.config.SPOTIFY_REFRESH_TOKEN = 'initial';
  const playback = () =>
    handleRequest(new Request('https://example.test/spotify?playback=1'), services);

  const responses = await Promise.all(Array.from({ length: 5 }, playback));
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200, 200, 200],
  );
  assert.equal(refreshes, 1);
  assert.equal(await services.state.get('refresh_token'), 'rotated');

  await services.state.delete('access_token');
  refuse = true;
  const refused = await playback();
  assert.equal(refused.status, 401);
  assert.deepEqual(await refused.json(), { error: 'spotify_unauthorized' });

  const bare = testServices();
  const unconfigured = await handleRequest(
    new Request('https://example.test/spotify?playback=1'),
    bare,
  );
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { error: 'spotify_not_configured' });
});
