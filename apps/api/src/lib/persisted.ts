import { z } from 'zod';
import type { Services } from '../contracts.js';
import { json } from './http.js';
import { MINUTE, REFRESH_COOLDOWN_TTL } from './ttl.js';

// A value fetched from an upstream and kept in persistent state, so a slow or
// failing upstream never sits between a visitor and an answer. Reads follow
// stale-while-revalidate: a fresh value is returned as is, an old one is
// returned at once while a refresh runs in the background, and only the very
// first request for a key waits on the upstream. A failed refresh keeps the
// previous value; it is never replaced by an error.

const envelope = z.object({ updatedAt: z.number(), version: z.string(), data: z.unknown() });

export interface Persisted<T> {
  data: T;
  /** Epoch milliseconds of the load that produced `data`. */
  updatedAt: number;
  /** True when `data` is older than its ttl and a refresh has been started. */
  stale: boolean;
  /** Seconds `data` counts as fresh: the source's ttl, or what `ttlFor` chose. */
  ttl: number;
}

export interface PersistedSource<T extends z.ZodType> {
  /** State key. Include every identity the value depends on. */
  key: string;
  /** Seconds a stored value counts as fresh. */
  ttl: number;
  /** A shorter lifetime for a particular value, such as one that came back incomplete. */
  ttlFor?: (data: z.output<T>) => number;
  schema: T;
  /**
   * Changes whenever the stored shape or the configuration behind it does. A
   * value stored under another version is refreshed before it is served.
   */
  version?: string;
  /** Fetch a new value; receives the previous one so partial failures can keep parts of it. */
  load: (previous: z.output<T> | null) => Promise<z.output<T>>;
}

async function read<T extends z.ZodType>(
  services: Services,
  source: PersistedSource<T>,
): Promise<{ data: z.output<T>; updatedAt: number; current: boolean } | null> {
  try {
    const stored = envelope.safeParse(JSON.parse((await services.state.get(source.key)) || 'null'));
    if (!stored.success) return null;
    const data = source.schema.safeParse(stored.data.data);
    if (!data.success) return null;
    return {
      data: data.data,
      updatedAt: stored.data.updatedAt,
      current: stored.data.version === (source.version ?? ''),
    };
  } catch {
    return null;
  }
}

/** Load now and store the result. Throws when the upstream does; state is left untouched. */
export async function refreshPersisted<T extends z.ZodType>(
  services: Services,
  source: PersistedSource<T>,
): Promise<Persisted<z.output<T>>> {
  const previous = await read(services, source);
  const data = await source.load(previous?.data ?? null);
  const updatedAt = services.now();
  await services.state.put(
    source.key,
    JSON.stringify({ updatedAt, version: source.version ?? '', data }),
  );
  return { data, updatedAt, stale: false, ttl: lifetime(source, data) };
}

const lifetime = <T extends z.ZodType>(source: PersistedSource<T>, data: z.output<T>) =>
  source.ttlFor?.(data) ?? source.ttl;

// The cooldown is persisted, not in memory, so cold Worker instances in
// different data centers do not each retry a failing upstream.
async function attempt<T extends z.ZodType>(
  services: Services,
  source: PersistedSource<T>,
): Promise<Persisted<z.output<T>> | null> {
  const lock = `${source.key}:retry`;
  if (await services.state.get(lock)) return null;
  await services.state.put(lock, '1', { expirationTtl: REFRESH_COOLDOWN_TTL });
  try {
    return await refreshPersisted(services, source);
  } catch (error) {
    console.warn('Refresh failed', source.key, error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

/** The stored value, refreshed as described above; null only when nothing was ever stored. */
export async function readPersisted<T extends z.ZodType>(
  services: Services,
  source: PersistedSource<T>,
): Promise<Persisted<z.output<T>> | null> {
  const stored = await read(services, source);
  if (stored?.current) {
    const ttl = lifetime(source, stored.data);
    const stale = services.now() - stored.updatedAt >= ttl * 1000;
    if (stale) services.background(attempt(services, source));
    return { data: stored.data, updatedAt: stored.updatedAt, stale, ttl };
  }
  // Nothing usable for this version: wait once, and fall back to whatever an
  // older version left behind rather than answering with nothing.
  const fresh = await attempt(services, source);
  if (fresh) return fresh;
  return stored
    ? { data: stored.data, updatedAt: stored.updatedAt, stale: true, ttl: source.ttl }
    : null;
}

/**
 * How long a response built from `value` may be cached, in seconds: the rest
 * of its ttl when fresh, a minute when stale so the refreshed value is picked
 * up as soon as it lands.
 */
export function remainingTtl(services: Services, value: Persisted<unknown>, ttl: number): number {
  if (value.stale) return MINUTE;
  const left = Math.ceil(ttl - (services.now() - value.updatedAt) / 1000);
  return Math.max(MINUTE, Math.min(ttl, left));
}

/** JSON response for a persisted value, or a 502 when there has never been one. */
export function persistedResponse(
  services: Services,
  value: Persisted<unknown> | null,
  ttl: number,
  error: string,
): Response {
  if (!value) return json({ error }, 502);
  return json(value.data, 200, remainingTtl(services, value, ttl));
}
