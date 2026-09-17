import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { ResponseCache, Services, StateStore } from '../contracts.js';
import { configuration } from '../config.js';

const hash = (key: string) => createHash('sha256').update(key).digest('hex');
async function atomicWrite(path: string, value: string | Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, value, { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function diskState(directory: string, now = Date.now): Promise<StateStore> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = (key: string) => join(directory, hash(key));
  return {
    async get(key) {
      try {
        const entry: { value: string; expires: number } = JSON.parse(
          await readFile(path(key), 'utf8'),
        );
        if (entry.expires && entry.expires <= now()) return null;
        return typeof entry.value === 'string' ? entry.value : null;
      } catch (error) {
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT')
          return null;
        throw error;
      }
    },
    async put(key, value, options) {
      const expires = options?.expirationTtl ? now() + options.expirationTtl * 1000 : 0;
      await atomicWrite(path(key), JSON.stringify({ value, expires }));
    },
    async delete(key) {
      try {
        await unlink(path(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
  };
}

export async function diskCache(
  directory: string,
  maxBytes = 256 * 1024 * 1024,
  now = Date.now,
): Promise<ResponseCache> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  // Serialize writes and pruning. This directory belongs to one Node process.
  let writes = Promise.resolve();
  async function prune() {
    const entries = await Promise.all(
      (await readdir(directory)).map(async (name) => {
        const path = join(directory, name);
        const info = await stat(path);
        return { path, size: info.size, time: info.mtimeMs };
      }),
    );
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries.sort((a, b) => a.time - b.time)) {
      if (total <= maxBytes) break;
      await unlink(entry.path);
      total -= entry.size;
    }
  }
  await prune();
  return {
    async match(key) {
      try {
        const bytes = await readFile(join(directory, hash(key.url)));
        const separator = bytes.indexOf(10);
        if (separator < 0) return undefined;
        const entry: { expires: number; status: number; headers: [string, string][] } = JSON.parse(
          bytes.subarray(0, separator).toString(),
        );
        if (entry.expires <= now()) return undefined;
        const headers = new Headers(entry.headers);
        const ttl = Math.max(0, Math.floor((entry.expires - now()) / 1000));
        for (const header of [
          'Cache-Control',
          'CDN-Cache-Control',
          'Cloudflare-CDN-Cache-Control',
        ]) {
          if (headers.has(header)) headers.set(header, `public, max-age=${ttl}`);
        }
        return new Response(bytes.subarray(separator + 1), { status: entry.status, headers });
      } catch (error) {
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT')
          return undefined;
        throw error;
      }
    },
    async put(key, response) {
      const ttl = Number(
        /(?:^|[, ])max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '')?.[1] || 0,
      );
      if (response.status !== 200 || ttl <= 0 || response.headers.has('Set-Cookie')) return;
      const body = Buffer.from(await response.arrayBuffer());
      const metadata = JSON.stringify({
        expires: now() + ttl * 1000,
        status: response.status,
        headers: [...response.headers],
      });
      const bytes = Buffer.concat([Buffer.from(metadata + '\n'), body]);
      if (bytes.length > maxBytes) return;
      const pending = writes.then(async () => {
        await atomicWrite(join(directory, hash(key.url)), bytes);
        await prune();
      });
      writes = pending.catch(() => {});
      await pending;
    },
  };
}

export async function nodeServices(
  values = process.env,
  dataDirectory = values.API_DATA_DIR || '.api-data',
) {
  const pending = new Set<Promise<unknown>>();
  const budget = Number(values.API_CACHE_MAX_BYTES || 256 * 1024 * 1024);
  if (!Number.isSafeInteger(budget) || budget <= 0)
    throw new Error('API_CACHE_MAX_BYTES must be a positive integer');
  const services: Services = {
    config: configuration(values),
    state: await diskState(join(dataDirectory, 'state')),
    cache: await diskCache(join(dataDirectory, 'cache'), budget),
    fetch: (...args) => fetch(...args),
    now: Date.now,
    background(task) {
      const tracked = task.catch((error) => console.error('Background task failed', error));
      pending.add(tracked);
      void tracked.finally(() => pending.delete(tracked));
    },
  };
  return { services, drain: () => Promise.allSettled([...pending]) };
}
