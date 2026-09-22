import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, createFetchMock } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('real Worker runtime serves cached media, snapshots, HEAD, and prefixed routes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'portfolio-worker-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scriptPath = join(directory, 'worker.js');
  await build({
    entryPoints: [fileURLToPath(new URL('../src/entrypoints/worker.ts', import.meta.url))],
    outfile: scriptPath,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  fetchMock
    .get('https://i.scdn.co')
    .intercept({ path: '/image/test' })
    .reply(200, 'image-bytes', { headers: { 'Content-Type': 'image/png' } });
  fetchMock
    .get('https://www.linkedin.com')
    .intercept({ path: '/in/hambn/' })
    .reply(
      200,
      '<link rel="canonical" href="https://www.linkedin.com/in/hambn/"><section class="top-card-layout"><h1 class="top-card-layout__title">LinkedIn Worker Test</h1><span>655 followers</span></section>',
    );
  const worker = new Miniflare({
    modules: true,
    modulesRoot: directory,
    scriptPath,
    compatibilityDate: '2026-06-23',
    kvNamespaces: ['SPOTIFY_KV'],
    bindings: { CACHE_VERSION: 'test' },
    fetchMock,
  });
  t.after(() => worker.dispose());
  const kv = await worker.getKVNamespace('SPOTIFY_KV');
  await kv.put(
    'telegram:profile:v1:ham_bn',
    JSON.stringify({
      profile: { username: 'ham_bn', name: 'Saved profile', photo: null },
      image: null,
      updatedAt: new Date().toISOString(),
    }),
  );
  const asset = Buffer.from('https://i.scdn.co/image/test').toString('base64url');
  const url = `https://api.test/api/media/spotify/${asset}`;
  assert.equal(await (await worker.dispatchFetch(url)).text(), 'image-bytes');
  // The mock permits exactly one upstream request. This must be a Cache API hit.
  assert.equal(await (await worker.dispatchFetch(url)).text(), 'image-bytes');
  assert.equal(await (await worker.dispatchFetch(url, { method: 'HEAD' })).text(), '');
  const profile = await (await worker.dispatchFetch('https://api.test/api/telegram')).json();
  assert.equal(profile.name, 'Saved profile');
  assert.equal(
    (await worker.dispatchFetch('https://api.test/api/steam', { method: 'POST' })).status,
    405,
  );
  const linkedIn = await (await worker.dispatchFetch('https://api.test/api/linkedin')).json();
  assert.equal(linkedIn.name, 'LinkedIn Worker Test');
  assert.equal(linkedIn.followers, '655');
  assert.equal((await worker.dispatchFetch('https://api.test/api/linkedin')).status, 200);
  fetchMock.assertNoPendingInterceptors();

  const presenceWorker = new Miniflare({
    workers: [
      {
        name: 'api',
        modules: true,
        modulesRoot: directory,
        scriptPath,
        compatibilityDate: '2026-06-23',
        kvNamespaces: ['SPOTIFY_KV'],
        bindings: { CACHE_VERSION: 'test', DISCORD_ID: '123' },
        outboundService: 'upstream',
      },
      {
        name: 'upstream',
        modules: true,
        compatibilityDate: '2026-06-23',
        script: `
        export default { fetch() {
          const pair = new WebSocketPair();
          pair[1].accept();
          pair[1].addEventListener('message', event => pair[1].send(event.data));
          return new Response(null, { status: 101, webSocket: pair[0] });
        } };
      `,
      },
    ],
  });
  t.after(() => presenceWorker.dispose());
  const upgrade = await presenceWorker.dispatchFetch('https://api.test/api/discord/socket', {
    headers: { Upgrade: 'websocket' },
  });
  assert.equal(upgrade.status, 101);
  const socket = upgrade.webSocket;
  assert.ok(socket);
  socket.accept();
  t.after(() => socket.close());
  const message = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Relay response timed out')), 5000);
    socket.addEventListener(
      'message',
      (event) => {
        clearTimeout(timeout);
        resolve(JSON.parse(event.data));
      },
      { once: true },
    );
  });
  socket.send('{"op":2,"d":{"subscribe_to_id":"other"}}');
  assert.deepEqual(await message, { op: 2, d: { subscribe_to_id: '123' } });
});
