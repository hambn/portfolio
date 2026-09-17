import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { refresh } from '../src/scheduled.js';
import { testServices } from './helpers.js';
import { configuredTelegramUsername as username } from '../src/providers/telegram.js';
import { telegramUsername } from '../../shared/telegram.js';

const html = `<meta property="og:description" content="Generic contact text">
<div class="tgme_page_title"><span dir="auto">Hamed &amp; Friends</span></div>
<div class="tgme_page_extra">@${username}</div>
<div class="tgme_page_description">Hello<br>World &#128075;</div>
<meta content="https://cdn4.telesco.pe/avatar.jpg" property="og:image">`;

test('username validation and URL configuration', async () => {
  const links = JSON.parse(
    await readFile(new URL('../../public/contents/links/links.json', import.meta.url), 'utf8'),
  );
  assert.equal(username, telegramUsername(links.telegram.url));
  assert.equal(telegramUsername('https://t.me/Other_User'), 'other_user');
  for (const value of ['https://evil.t.me/hello', 'hello world', '../hello', '%ZZ']) {
    assert.equal(telegramUsername(value), null);
  }
});

test('cold requests bootstrap once; scheduled snapshots cache HTML and image; failed refresh retains data', async (t) => {
  const values = new Map<string, string>();
  const services = testServices({
    fetch: (...args) => fetch(...args),
    state: {
      delete: async () => {},
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        values.set(key, value);
      },
    },
  });
  let requests = 0;
  let failing = false;
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    requests++;
    if (failing) return new Response('unavailable', { status: 503 });
    return String(url).startsWith('https://t.me/')
      ? new Response(html)
      : new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } });
  });
  const request = (path = '/telegram', method = 'GET') =>
    handleRequest(new Request(`https://api.test${path}`, { method }), services);
  const coldResponse = await request();
  assert.equal(coldResponse.status, 200);
  assert.equal(requests, 2);
  for (let i = 0; i < 10; i++) {
    const response = await request(`/telegram?username=${username}`);
    const profile = await response.json();
    assert.equal(profile.name, 'Hamed & Friends');
    assert.equal(profile.description, 'Hello\nWorld 👋');
    assert.equal(profile.username, username);
    assert.match(profile.photo, /\/telegram\/avatar\?/);
    assert.ok(profile.updatedAt);
  }
  assert.deepEqual(
    new Uint8Array(await (await request('/telegram/avatar')).arrayBuffer()),
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(await (await request('/telegram', 'HEAD')).text(), '');
  assert.equal((await request('/telegram?username=other_user')).status, 400);
  assert.equal((await request('/telegram/arbitrary')).status, 404);
  assert.equal(requests, 2);
  await refresh(services);
  assert.equal(requests, 4);
  failing = true;
  await assert.rejects(refresh(services));
  assert.equal((await request()).status, 200);
  assert.equal(requests, 5);
});

test('invalid HTML never replaces the cache; profile metadata survives avatar failures', async (t) => {
  let writes = 0;
  let upstream = '<html>Not a profile</html>';
  const values = new Map<string, string>();
  const services = testServices({
    fetch: (...args) => fetch(...args),
    state: {
      delete: async () => {},
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        writes++;
        values.set(key, value);
      },
    },
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(upstream));
  await assert.rejects(refresh(services));
  assert.equal(writes, 0);
  upstream = 'x'.repeat(256 * 1024 + 1);
  await assert.rejects(refresh(services));
  assert.equal(writes, 0);
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) =>
    String(url).startsWith('https://t.me/')
      ? new Response(html)
      : new Response(new Uint8Array(1024 * 1024 + 1), {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
  );
  await refresh(services);
  assert.equal(writes, 1);
  const snapshot = JSON.parse(values.get('telegram:profile:v1:ham_bn') || '{}');
  assert.equal(snapshot.profile.name, 'Hamed & Friends');
  assert.equal(snapshot.image, null);
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) =>
    String(url).startsWith('https://t.me/')
      ? new Response(html)
      : new Response('<svg></svg>', { headers: { 'Content-Type': 'image/svg+xml' } }),
  );
  await refresh(services);
  assert.equal(writes, 2);
  assert.equal(JSON.parse(values.get('telegram:profile:v1:ham_bn') || '{}').image, null);
});

test('avatar download failure preserves the previous image; stale snapshots expire', async () => {
  let now = Date.now();
  let brokenImage = false;
  const services = testServices({
    now: () => now,
    fetch: async (url) => {
      if (String(url).startsWith('https://t.me/')) return new Response(html);
      return brokenImage
        ? new Response(null, { status: 503 })
        : new Response(new Uint8Array([9, 8, 7]), { headers: { 'Content-Type': 'image/png' } });
    },
  });
  await refresh(services);
  brokenImage = true;
  await refresh(services);
  const request = new Request('https://api.test/telegram/avatar');
  assert.deepEqual(
    new Uint8Array(await (await handleRequest(request, services)).arrayBuffer()),
    new Uint8Array([9, 8, 7]),
  );
  now += 8 * 86400000;
  assert.equal((await handleRequest(request, services)).status, 503);
});
