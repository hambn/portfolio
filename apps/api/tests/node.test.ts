import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { diskState, diskCache } from '../src/adapters/node.js';
import { createServer } from '../src/entrypoints/node.js';
import { testServices } from './helpers.js';
import { handleRequest } from '../src/app.js';
import { refreshJob } from '../src/scheduled.js';

test('disk state and binary cache survive restart; TTL and eviction spare tokens', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-api-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let now = 1000;
  let state = await diskState(join(root, 'state'), () => now);
  let cache = await diskCache(join(root, 'cache'), 1200, () => now);
  await state.put('refresh_token', 'secret');
  await state.put('access_token', 'temporary', { expirationTtl: 60 });
  const key = new Request('https://api.test/media/a');
  await cache.put(
    key,
    new Response(new Uint8Array([0, 255, 1]), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' },
    }),
  );
  state = await diskState(join(root, 'state'), () => now);
  cache = await diskCache(join(root, 'cache'), 1200, () => now);
  assert.equal(await state.get('refresh_token'), 'secret');
  assert.deepEqual(
    new Uint8Array(await (await cache.match(key))!.arrayBuffer()),
    new Uint8Array([0, 255, 1]),
  );
  now += 61000;
  assert.equal(await state.get('access_token'), null);
  // Reading an expired entry removes it, leaving only the long-lived token.
  assert.equal((await readdir(join(root, 'state'))).length, 1);
  assert.equal(await cache.match(key), undefined);
  for (let i = 0; i < 8; i++)
    await cache.put(
      new Request(`https://api.test/${i}`),
      new Response('x'.repeat(300), { headers: { 'Cache-Control': 'public, max-age=60' } }),
    );
  const sizes = await Promise.all(
    (await readdir(join(root, 'cache'))).map(
      async (file) => (await stat(join(root, 'cache', file))).size,
    ),
  );
  assert.ok(sizes.reduce((a, b) => a + b, 0) <= 1200);
  assert.equal(await state.get('refresh_token'), 'secret');
});

test('Node HTTP adapter matches the shared Worker application responses', async (t) => {
  const services = testServices();
  const server = createServer(services);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  for (const [path, method] of [
    ['/api/health', 'GET'],
    ['/health', 'HEAD'],
    ['/steam', 'OPTIONS'],
    ['/missing', 'GET'],
    ['/steam', 'POST'],
  ]) {
    const url: string = `http://127.0.0.1:${address.port}${path}`;
    const expected = await handleRequest(new Request(url, { method }), services);
    const actual: Response = await fetch(url, { method });
    assert.equal(actual.status, expected.status);
    assert.equal(await actual.text(), await expected.text());
    assert.equal(actual.headers.get('Cache-Control'), expected.headers.get('Cache-Control'));
  }
});

test('scheduled Node refresh coalesces overlapping invocations and can retry', async () => {
  let calls = 0;
  const services = testServices({
    fetch: async () => {
      calls++;
      return new Response('unavailable', { status: 503 });
    },
  });
  const run = refreshJob(services);
  const first = run();
  const second = run();
  assert.equal(first, second);
  await assert.rejects(first);
  assert.equal(calls, 3);
  await assert.rejects(run());
  assert.equal(calls, 6);
});

test('Node presence relay forwards frames and pins the upstream subscription', async (t) => {
  const { default: WebSocket, WebSocketServer } = await import('ws');
  const { attachPresence } = await import('../src/adapters/node-presence.js');
  const upstream = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await once(upstream, 'listening');
  const upstreamAddress = upstream.address();
  assert.ok(upstreamAddress && typeof upstreamAddress !== 'string');
  const server = createServer(testServices());
  const close = attachPresence(
    server,
    '123',
    () => new WebSocket(`ws://127.0.0.1:${upstreamAddress.port}`),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    close();
    server.close();
    for (const socket of upstream.clients) socket.terminate();
    upstream.close();
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const connected = once(upstream, 'connection');
  const client = new WebSocket(`ws://127.0.0.1:${address.port}/api/discord/socket`);
  t.after(() => client.terminate());
  await once(client, 'open');
  const [remote] = await connected;
  const hello = once(client, 'message');
  remote.send('{"op":1}');
  assert.equal((await hello)[0].toString(), '{"op":1}');
  const subscription = once(remote, 'message');
  client.send('{"op":2,"d":{"subscribe_to_id":"other"}}');
  assert.deepEqual(JSON.parse((await subscription)[0].toString()), {
    op: 2,
    d: { subscribe_to_id: '123' },
  });
});

test('malformed disk metadata is a miss and can be replaced', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = await diskState(join(root, 'state'), () => 1000);
  const cache = await diskCache(join(root, 'cache'), 4096, () => 1000);
  const key = new Request('https://api.test/corrupt');
  const filename = createHash('sha256').update(key.url).digest('hex');
  for (const metadata of [
    null,
    {},
    { value: 'secret', expires: 'never' },
    { value: 1, expires: 0 },
  ]) {
    await writeFile(join(root, 'state', filename), JSON.stringify(metadata));
    assert.equal(await state.get(key.url), null);
  }
  for (const metadata of [
    null,
    {},
    { expires: 'never', status: 200, headers: [] },
    { expires: 10000, status: 204, headers: [] },
    { expires: 10000, status: 200, headers: [['bad header', 'value']] },
  ]) {
    await writeFile(join(root, 'cache', filename), JSON.stringify(metadata) + '\nbody');
    assert.equal(await cache.match(key), undefined);
  }
  await state.put(key.url, 'replacement');
  assert.equal(await state.get(key.url), 'replacement');
  await cache.put(key, new Response('replacement', { headers: { 'Cache-Control': 'max-age=60' } }));
  assert.equal(await (await cache.match(key))!.text(), 'replacement');
});

test('cache accounts for replacements and serializes concurrent eviction', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'portfolio-eviction-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = await diskCache(root, 700);
  const keys = ['a', 'b', 'c'].map((name) => new Request(`https://api.test/${name}`));
  const response = (size: number) =>
    new Response('x'.repeat(size), {
      headers: { 'Cache-Control': 'max-age=60' },
    });
  await cache.put(keys[0], response(200));
  await cache.put(keys[1], response(200));
  await cache.put(keys[0], response(1));
  assert.ok(await cache.match(keys[1]), 'shrinking a replacement must not overcount bytes');
  await cache.put(keys[2], response(200));
  assert.equal(await cache.match(keys[1]), undefined, 'replacement refreshes write order');
  assert.ok(await cache.match(keys[0]));
  await Promise.all(keys.map((key) => cache.put(key, response(200))));
  const sizes = await Promise.all(
    (await readdir(root)).map(async (name) => (await stat(join(root, name))).size),
  );
  assert.ok(sizes.reduce((sum, size) => sum + size, 0) <= 700);
  assert.ok(await cache.match(keys[2]));
});
