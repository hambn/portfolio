import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { nodeServices } from '../api/src/adapters/node.ts';
import { handleRequest } from '../api/src/app.ts';
import { refreshLinkedIn } from '../api/src/providers/linkedin.ts';
import { mediaPath } from '../api/src/media/sources.ts';

const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'portfolio-container-'));
const name = `portfolio-validation-${randomUUID()}`;
const path = mediaPath('https://i.scdn.co/image/container-test');
try {
  const { services } = await nodeServices({}, directory);
  services.fetch = async () =>
    new Response('persisted-image', { headers: { 'Content-Type': 'image/png' } });
  await services.state.put('refresh_token', 'test-rotated-token');
  await services.state.put(
    'telegram:profile:v1:ham_bn',
    JSON.stringify({
      profile: { username: 'ham_bn', name: 'Persisted profile', photo: null },
      image: null,
      updatedAt: new Date().toISOString(),
    }),
  );
  await handleRequest(new Request(`http://localhost:8787${path}`), services);
  const linkedInHtml = await readFile(
    new URL('../api/tests/fixtures/linkedin-public.html', import.meta.url),
    'utf8',
  );
  services.fetch = async (input) =>
    String(input).startsWith('https://www.linkedin.com/in/')
      ? new Response(linkedInHtml)
      : new Response('linkedin-image', { headers: { 'Content-Type': 'image/jpeg' } });
  await refreshLinkedIn(services);
  await run('docker', [
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'none',
    '--user',
    `${process.getuid()}:${process.getgid()}`,
    '-v',
    `${directory}:/data`,
    'portfolio-api-validation',
  ]);
  const check = `
    const assert = await import('node:assert/strict');
    for (let i = 0; i < 50; i++) {
      try { await fetch('http://localhost:8787/health'); break; }
      catch { await new Promise(r => setTimeout(r, 100)); }
    }
    assert.equal(await (await fetch(${JSON.stringify(`http://localhost:8787${path}`)})).text(), 'persisted-image');
    assert.equal((await (await fetch('http://localhost:8787/telegram')).json()).name, 'Persisted profile');
    const linkedin = await (await fetch('http://localhost:8787/linkedin')).json();
    assert.equal(linkedin.name, 'hamed ghasempour');
    assert.equal(new URL(linkedin.avatar).hostname, 'localhost');
    assert.equal(await (await fetch(linkedin.avatar)).text(), 'linkedin-image');
    assert.equal(await (await fetch(linkedin.banner)).text(), 'linkedin-image');
    console.log('Container served persisted Telegram, LinkedIn, and images without network access');
  `;
  process.stdout.write(
    (await run('docker', ['exec', name, 'node', '--input-type=module', '-e', check])).stdout,
  );
  await run('docker', ['restart', name]);
  process.stdout.write(
    (await run('docker', ['exec', name, 'node', '--input-type=module', '-e', check])).stdout,
  );
  assert.equal(await services.state.get('refresh_token'), 'test-rotated-token');
} finally {
  await run('docker', ['rm', '-f', name]).catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
