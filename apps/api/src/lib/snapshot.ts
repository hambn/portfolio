import { z } from 'zod';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from './http.js';
import { withCache } from './cache.js';
import { allowedMedia } from '@portfolio/shared/media';
import { IMAGE_TTL, PROFILE_TTL, REFRESH_COOLDOWN_TTL, SNAPSHOT_STALE_MS } from './ttl.js';

// Shared plumbing for the providers that serve a persisted profile snapshot
// (x, telegram, linkedin): read the stored snapshot, refresh it behind a
// cooldown, embed its images, and serve those images back. Each provider keeps
// its own parsing, schema and response shape.

// `version` is a fingerprint of the image bytes. It is what the image's URL is
// versioned by, so an hourly refresh that downloads the same picture again
// leaves the URL, and every browser's cached copy of it, as they were.
// Snapshots stored before fingerprints existed have none.
export const storedImage = z.object({
  contentType: z.string(),
  data: z.string(),
  version: z.string().optional(),
});
type StoredImage = z.infer<typeof storedImage>;
type ImageKind = 'avatar' | 'banner';

export const PROFILE_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

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
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const version = [...digest.subarray(0, 12)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return { contentType, data: btoa(binary), version };
  } catch {
    return null;
  }
}

/** Download a profile's avatar and banner, one after the other. */
export async function downloadImages(
  services: Services,
  provider: string,
  profile: Record<ImageKind, string | null>,
  previous: Record<ImageKind, StoredImage | null> | undefined,
  init: RequestInit,
): Promise<Record<ImageKind, StoredImage | null>> {
  const images: Record<ImageKind, StoredImage | null> = { avatar: null, banner: null };
  for (const kind of ['avatar', 'banner'] as const) {
    const source = profile[kind];
    if (!source || !allowedMedia(provider, source)) continue;
    // Keep a previously downloaded image when the CDN is temporarily unavailable.
    images[kind] =
      (await downloadImage(services, provider, source, init, 2 * 1024 * 1024)) ??
      previous?.[kind] ??
      null;
  }
  return images;
}

interface ImageSnapshot {
  profile: { username: string };
  images: Record<ImageKind, StoredImage | null>;
  updatedAt: string;
}

/**
 * What an image's URL is versioned by: its own fingerprint, or the snapshot's
 * `updatedAt` for an image stored before fingerprints existed.
 */
export function imageVersion(image: StoredImage, updatedAt: string): string {
  return image.version ?? updatedAt;
}

/** The API path of a stored image, versioned by its content. */
export function imagePath(provider: string, snapshot: ImageSnapshot, kind: ImageKind) {
  const image = snapshot.images[kind];
  return image
    ? `/${provider}/${kind}?username=${snapshot.profile.username}&v=${encodeURIComponent(imageVersion(image, snapshot.updatedAt))}`
    : null;
}

// Carries the serving snapshot's version from imageResponse to cachedImage.
const VERSION_HEADER = 'X-Snapshot-Version';

/**
 * Serve a snapshot image through the response cache. Pages link to it with the
 * image's version as `v`, so that version keys the entry: a changed image is a
 * new key, and a repeat request skips reading and decoding the whole stored
 * snapshot. A `v` that is not the stored image's (checked on the miss, which
 * reads the snapshot anyway) is served uncached, as is a request without one,
 * so made-up versions cannot fill the cache with copies.
 *
 * A URL carrying the image's own version never answers with different bytes,
 * so browsers may keep it for IMAGE_TTL without asking again. That lifetime is
 * put on the way out: the response cache stores the entry with PROFILE_TTL,
 * which bounds how long an image can outlive its snapshot's stale limit.
 */
export async function cachedImage(
  services: Services,
  request: Request,
  path: string,
  create: () => Promise<Response>,
): Promise<Response> {
  const version = new URL(request.url).searchParams.get('v');
  // An image stored before fingerprints existed is versioned by a date.
  if (!version || snapshotExpired(services, version)) return create().then(withoutVersion);
  const response = await withCache(
    services,
    request,
    async () => {
      const created = withoutVersion(await create());
      if (created.version !== version) created.headers.set('Cache-Control', 'no-store');
      return created;
    },
    `${path}/${encodeURIComponent(version)}`,
  );
  // Only a 200 for the stored version is cacheable at this point.
  if (response.status !== 200 || !/max-age=[1-9]/.test(response.headers.get('Cache-Control') || ''))
    return response;
  const lasting = new Response(response.body, response);
  lasting.headers.set('Cache-Control', `public, max-age=${IMAGE_TTL}, immutable`);
  return lasting;
}

function withoutVersion(response: Response): Response & { version?: string } {
  const version = response.headers.get(VERSION_HEADER) ?? undefined;
  if (!version) return response;
  const copy: Response & { version?: string } = new Response(response.body, response);
  copy.headers.delete(VERSION_HEADER);
  copy.version = version;
  return copy;
}

/** Serve an image held inside the snapshot last refreshed at `updatedAt`. */
export function imageResponse(image: StoredImage, updatedAt: string): Response {
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      ...CORS,
      'Content-Type': image.contentType,
      'Cache-Control': `public, max-age=${PROFILE_TTL}`,
      'X-Content-Type-Options': 'nosniff',
      [VERSION_HEADER]: imageVersion(image, updatedAt),
    },
  });
}
