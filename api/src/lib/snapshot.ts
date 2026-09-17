import type { z } from 'zod';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from './http.js';
import { allowedMedia } from '../media/sources.js';
import { PROFILE_TTL, REFRESH_COOLDOWN_TTL, SNAPSHOT_STALE_MS } from './ttl.js';

// Shared plumbing for the providers that serve a persisted profile snapshot
// (x, telegram, linkedin): read the stored snapshot, refresh it behind a
// cooldown, embed its images, and serve those images back. Each provider keeps
// its own parsing, schema and response shape.

export interface StoredImage {
  contentType: string;
  data: string;
}

/** Parse a stored snapshot, treating missing, malformed and invalid alike. */
export function parseSnapshot<T extends z.ZodType>(
  raw: string | null,
  schema: T,
): z.infer<T> | null {
  try {
    const result = schema.safeParse(JSON.parse(raw || 'null'));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Run `refresh` unless a recent attempt already failed. The cooldown is
 * persisted rather than in-memory so cold Worker instances in different data
 * centers do not each hammer the upstream profile.
 */
export async function refreshWithCooldown<T>(
  services: Services,
  key: string,
  refresh: () => Promise<T | undefined>,
): Promise<T | null> {
  if (await services.state.get(key)) return null;
  await services.state.put(key, '1', { expirationTtl: REFRESH_COOLDOWN_TTL });
  try {
    return (await refresh()) ?? null;
  } catch {
    // Retry on the next scheduled refresh.
    return null;
  }
}

/** A snapshot this old is no longer served, however good it once was. */
export function snapshotExpired(services: Services, updatedAt: string): boolean {
  return services.now() - Date.parse(updatedAt) > SNAPSHOT_STALE_MS;
}

/** 503 for a snapshot that is missing or too stale to serve. */
export function pendingResponse(body: unknown): Response {
  const response = json(body, 503);
  response.headers.set('Retry-After', String(REFRESH_COOLDOWN_TTL));
  return response;
}

/**
 * Download an image into the snapshot as base64. Returns null on any failure so
 * the caller can decide between keeping the previously stored image and
 * dropping it; it never throws.
 */
export async function downloadImage(
  services: Services,
  provider: string,
  source: string,
  init: RequestInit,
  maxBytes: number,
): Promise<StoredImage | null> {
  try {
    const response = await fetchAllowed(
      services,
      source,
      (url) => allowedMedia(provider, url),
      init,
    );
    const contentType = response.headers.get('Content-Type')?.split(';')[0] || '';
    if (!response.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
      await response.body?.cancel();
      return null;
    }
    const bytes = await readBytes(response, maxBytes);
    if (!bytes) return null;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return { contentType, data: btoa(binary) };
  } catch {
    return null;
  }
}

/** Serve an image held inside a snapshot. */
export function imageResponse(image: StoredImage): Response {
  return new Response(
    Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0)),
    {
      headers: {
        ...CORS,
        'Content-Type': image.contentType,
        'Cache-Control': `public, max-age=${PROFILE_TTL}`,
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
