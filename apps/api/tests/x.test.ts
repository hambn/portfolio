import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { configuredXUsername as username, parseXProfile, refreshX } from '../src/providers/x.js';
import { refresh } from '../src/scheduled.js';
import { testServices } from './helpers.js';
import { xUsername } from '@portfolio/shared/x';

const html = `<meta property="profile:username" content="${username}">
<meta content="Hamed &amp; friends (@${username}) on X" property="og:title">
<meta name="twitter:description" content="Hello &amp; welcome">
<meta property="og:description" content="39 followers · 219 following. Joined Apr 2020.">
<meta name="twitter:label1" content="Posts"><meta name="twitter:data1" content="161">
<meta name="twitter:label2" content="Joined"><meta name="twitter:data2" content="April 2020">
<meta property="og:image" content="https://pbs.twimg.com/profile_images/avatar.jpg">
<img src="https://pbs.twimg.com/profile_banners/123/banner.jpg">
<a href="https://t.co/example">hgh.dev</a><a href="/${username}/following">219 Following</a>`;

test('X public HTML parsing and username validation', () => {
  const profile = parseXProfile(html, username!);
  assert.equal(profile?.name, 'Hamed & friends');
  assert.equal(profile?.description, 'Hello & welcome');
  assert.equal(profile?.posts, '161');
  assert.equal(profile?.joined, 'April 2020');
  assert.equal(profile?.followers, '39');
  assert.equal(profile?.following, '219');
  assert.equal(profile?.websiteLabel, 'hgh.dev');
  assert.equal(parseXProfile(html, 'other'), null);
  assert.equal(parseXProfile('<title>Log in to X</title>', username!), null);
  assert.equal(xUsername('https://twitter.com/Hambn4/'), 'hambn4');
  for (const value of [
    'https://x.com.evil/hambn4',
    'https://x.com/hambn4/posts',
    '../hello',
    'a'.repeat(16),
  ])
    assert.equal(xUsername(value), null);
});

test('X snapshots cache profile and images, retain data on failure, and expire', async () => {
  let calls = 0;
  let failed = false;
  let imageFailed = false;
  let now = Date.now();
  const services = testServices({
    now: () => now,
    fetch: async (url) => {
      calls++;
      if (failed) return new Response('Unavailable', { status: 503 });
      if (String(url).startsWith('https://x.com/')) return new Response(html);
      return imageFailed
        ? new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } })
        : new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
    },
  });
  const request = (path = '/api/x', method = 'GET') =>
    handleRequest(new Request(`https://api.test${path}`, { method }), services);
  const response = await request();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.avatar, /^\/api\/x\/avatar\?/);
  assert.match(body.banner, /^\/api\/x\/banner\?/);
  assert.equal(calls, 3);
  await request();
  for (const kind of ['avatar', 'banner'])
    assert.deepEqual(
      new Uint8Array(await (await request(`/x/${kind}`)).arrayBuffer()),
      new Uint8Array([1, 2, 3]),
    );
  assert.equal(await (await request('/x', 'HEAD')).text(), '');
  assert.equal(calls, 3);
  assert.equal((await request('/x?username=other')).status, 400);
  assert.equal((await request('/x/unknown')).status, 404);
  imageFailed = true;
  now += 3600000;
  await refreshX(services);
  assert.equal((await request('/x/avatar')).status, 200);
  failed = true;
  await assert.rejects(refreshX(services));
  assert.equal((await request()).status, 200);
  now += 8 * 86400000;
  assert.equal((await request()).status, 503);
});

test('versioned snapshot images are served from the response cache', async () => {
  let offline = false;
  const services = testServices({
    fetch: async (url) =>
      offline
        ? new Response(null, { status: 503 })
        : String(url).startsWith('https://x.com/')
          ? new Response(html)
          : new Response(new Uint8Array([4, 5, 6]), { headers: { 'Content-Type': 'image/png' } }),
  });
  await refreshX(services);
  const request = (path: string) =>
    handleRequest(new Request(new URL(path, 'https://api.test')), services);
  const { avatar } = await (await request('/x')).json();
  const first = await request(avatar);
  assert.equal(first.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.deepEqual(new Uint8Array(await first.arrayBuffer()), new Uint8Array([4, 5, 6]));
  // Neither the stored snapshot nor the network is needed for a repeat request.
  offline = true;
  await services.state.delete(`x:profile:v1:${username}`);
  const cached = await request(avatar);
  assert.equal(cached.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await cached.arrayBuffer()), new Uint8Array([4, 5, 6]));
});

test('failed cold fetches use cooldown and reject redirects outside X', async () => {
  let calls = 0;
  const services = testServices({
    fetch: async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://example.com/private' },
      });
    },
  });
  for (let i = 0; i < 3; i++) {
    const response = await handleRequest(new Request('https://api.test/x'), services);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '60');
  }
  assert.equal(calls, 1);
});

test('hourly scheduler refreshes X even when Telegram fails', async () => {
  const services = testServices({
    fetch: async (url) => {
      if (String(url).startsWith('https://t.me/')) return new Response(null, { status: 503 });
      if (String(url).startsWith('https://x.com/')) return new Response(html);
      return new Response(null, { status: 503 });
    },
  });
  await assert.rejects(refresh(services));
  assert.ok(await services.state.get(`x:profile:v1:${username}`));
});
