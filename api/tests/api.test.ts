import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { testServices } from './helpers.js';
import { mediaPath, rewriteMedia } from '../src/media/sources.js';
import { presenceMessage } from '../src/lib/presence.js';

const request = (path: string, method = 'GET') =>
  new Request(`https://api.test${path}`, { method });
test('routing, CORS, HEAD, OPTIONS and methods have consistent responses', async () => {
  const services = testServices();
  for (const [path, method, status] of [
    ['/health', 'GET', 200],
    ['/api/health', 'HEAD', 200],
    ['/missing', 'GET', 404],
    ['/steam/unknown', 'GET', 404],
    ['/steam', 'OPTIONS', 200],
    ['/steam', 'POST', 405],
    ['/missing', 'HEAD', 404],
  ] as const) {
    const response = await handleRequest(request(path, method), services);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    if (method === 'HEAD') assert.equal(await response.text(), '');
    if (method === 'POST') assert.equal(response.headers.get('Allow'), 'GET, HEAD, OPTIONS');
  }
});

test('media cache hits, expiration, version invalidation, HEAD and local URL rewriting', async () => {
  let now = 1000;
  let calls = 0;
  const services = testServices({
    now: () => now,
    fetch: async () => {
      calls++;
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
    },
  });
  const path = mediaPath('https://i.scdn.co/image/album')!;
  assert.equal((await handleRequest(request(path, 'HEAD'), services)).body, null);
  const response = await handleRequest(request(path), services);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
  assert.equal(calls, 1);
  now += 86400001;
  await handleRequest(request(path), services);
  assert.equal(calls, 2);
  services.config.CACHE_VERSION = 'next';
  await handleRequest(request(path), services);
  assert.equal(calls, 3);
  assert.deepEqual(
    rewriteMedia(
      {
        images: [{ url: 'https://i.scdn.co/image/album' }],
        url: 'https://open.spotify.com/track/one',
      },
      '/api',
    ),
    { images: [{ url: `/api${path}` }], url: 'https://open.spotify.com/track/one' },
  );
});

test('media rejects arbitrary destinations, redirects, SVG and oversized bodies', async () => {
  let calls = 0;
  const services = testServices({
    fetch: async () => {
      calls++;
      return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
    },
  });
  for (const source of [
    'http://i.scdn.co/image/a',
    'https://i.scdn.co.evil.test/a',
    'https://user:password@i.scdn.co/a',
    'https://127.0.0.1/a',
  ]) {
    assert.equal(mediaPath(source), null);
    const path = `/media/spotify/${btoa(source).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
    assert.equal((await handleRequest(request(path), services)).status, 400);
  }
  assert.equal(calls, 0);
  const path = mediaPath('https://i.scdn.co/image/album')!;
  assert.equal((await handleRequest(request(path), services)).status, 502);
  assert.equal(calls, 1);
  for (const response of [
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response('large', {
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(5 * 1024 * 1024) },
    }),
    new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } }),
  ]) {
    services.fetch = async () => response;
    assert.equal((await handleRequest(request(path), services)).status, 502);
  }
});

test('LinkedIn parses meta fields, caches for one hour and retains a bounded last good snapshot', async () => {
  let now = 1000;
  let calls = 0;
  const services = testServices({
    now: () => now,
    fetch: async () => {
      calls++;
      return new Response(
        '<meta content="Ada &amp; Team - Engineer | LinkedIn" property="og:title"><meta property="og:image" content="https://media.licdn.com/photo.jpg">',
      );
    },
  });
  const first = await handleRequest(request('/api/linkedin'), services);
  assert.equal(first.headers.get('Cache-Control'), 'public, max-age=3600');
  const data = await first.json();
  assert.equal(data.name, 'Ada & Team');
  assert.equal(data.headline, 'Engineer');
  assert.match(data.avatar, /^\/api\/media\/linkedin\//);
  await handleRequest(request('/api/linkedin'), services);
  assert.equal(calls, 2);
  now += 3600001;
  services.fetch = async () => {
    throw new Error('offline');
  };
  const stale = await handleRequest(request('/api/linkedin'), services);
  assert.equal(stale.headers.get('X-Cache-Stale'), 'true');
  assert.equal((await stale.json()).name, 'Ada & Team');
  now += 8 * 86400000;
  assert.equal(
    (await (await handleRequest(request('/api/linkedin'), services)).json()).error,
    'linkedin_fetch_failed',
  );
});

test('Steam and Discord payloads retain their fields and serve local artwork', async () => {
  const services = testServices({
    fetch: async (input) => {
      const url = String(input);
      if (url.includes('lanyard'))
        return Response.json({
          success: true,
          data: {
            discord_user: { id: '123', username: 'test', avatar: null },
            discord_status: 'online',
            activities: [],
          },
        });
      if (url.includes('GetPlayerSummaries'))
        return Response.json({
          response: {
            players: [
              {
                personaname: 'test',
                avatarfull: 'https://avatars.steamstatic.com/a.jpg',
                personastate: 1,
              },
            ],
          },
        });
      if (url.includes('GetSteamLevel')) return Response.json({ response: { player_level: 42 } });
      return Response.json({
        response: { games: [{ appid: 1, name: 'Game', playtime_forever: 120 }] },
      });
    },
  });
  const steam = await (await handleRequest(request('/steam'), services)).json();
  assert.equal(steam.level, 42);
  assert.equal(steam.favoriteGame.playtime_hours, 2);
  assert.match(steam.favoriteGame.images.header, /^https:\/\/api.test\/media\/steam\//);
  const discord = await (await handleRequest(request('/api/discord'), services)).json();
  assert.equal(discord.status, 'online');
  assert.equal(discord.avatar, '/api/discord/avatar');
});

test('Steam keeps the profile when optional endpoints fail, and fails without a summary', async () => {
  const summary = Response.json({
    response: { players: [{ personaname: 'test', personastate: 1 }] },
  });
  const services = testServices({
    fetch: async (input) => {
      const url = String(input);
      if (url.includes('GetPlayerSummaries')) return summary.clone();
      if (url.includes('GetSteamLevel')) return new Response('nope', { status: 500 });
      if (url.includes('GetRecentlyPlayedGames')) throw new Error('connection reset');
      return Response.json({
        response: { games: [{ appid: 1, name: 'Game', playtime_forever: 120 }] },
      });
    },
  });
  const response = await handleRequest(request('/steam'), services);
  assert.equal(response.status, 200);
  const steam = await response.json();
  assert.equal(steam.displayName, 'test');
  assert.equal(steam.level, 0);
  assert.deepEqual(steam.recentActivity, []);
  assert.equal(steam.favoriteGame.playtime_hours, 2);

  // A missing player summary leaves nothing worth rendering, so it still fails.
  const broken = testServices({
    fetch: async (input) =>
      String(input).includes('GetPlayerSummaries')
        ? new Response('nope', { status: 503 })
        : Response.json({ response: { games: [] } }),
  });
  assert.equal((await handleRequest(request('/steam'), broken)).status, 502);
});

test('presence relay pins subscriptions to the configured user', () => {
  assert.deepEqual(
    JSON.parse(presenceMessage('{"op":2,"d":{"subscribe_to_id":"other"}}', '123')!),
    { op: 2, d: { subscribe_to_id: '123' } },
  );
  assert.equal(presenceMessage('{"op":3}', '123'), '{"op":3}');
  assert.equal(presenceMessage('bad', '123'), null);
});

test('cache failures do not turn a valid upstream image into an outage', async () => {
  const services = testServices({
    fetch: async () => new Response('image', { headers: { 'Content-Type': 'image/png' } }),
    cache: {
      match: async () => {
        throw new Error('cache offline');
      },
      put: async () => {
        throw new Error('cache full');
      },
    },
  });
  const response = await handleRequest(
    request(mediaPath('https://i.scdn.co/image/test')!),
    services,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'image');
});
