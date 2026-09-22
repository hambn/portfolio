import type { Services } from '../contracts.js';
import { CORS, fetchAllowed, json, readBytes } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { MEDIA_TTL } from '../lib/ttl.js';
import { allowedMedia } from './sources.js';

export async function fetchMedia(
  services: Services,
  provider: string,
  source: string,
): Promise<Response> {
  const response = await fetchAllowed(services, source, (url) => allowedMedia(provider, url));
  const type = response.headers.get('Content-Type')?.split(';')[0].toLowerCase() || '';
  if (!response.ok || !/^image\/(jpeg|png|gif|webp|avif)$/.test(type)) {
    await response.body?.cancel();
    return json({ error: 'media_unavailable' }, 502);
  }
  // Buffer only a bounded image, so a truncated download never enters either cache.
  const bytes = await readBytes(response, 4 * 1024 * 1024);
  if (!bytes) return json({ error: 'media_too_large_or_incomplete' }, 502);
  return new Response(bytes, {
    headers: {
      ...CORS,
      'Content-Type': type,
      'Content-Length': String(bytes.length),
      'Cache-Control': `public, max-age=${MEDIA_TTL}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handle(request: Request, services: Services): Promise<Response> {
  // routes.ts only sends `/media/<provider>/<id>` with a base64url id.
  const [, , provider, id] = new URL(request.url).pathname.split('/');
  let source: string;
  try {
    source = atob(id.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return json({ error: 'invalid_media' }, 400);
  }
  if (!allowedMedia(provider, source)) return json({ error: 'invalid_media' }, 400);
  return withCache(services, request, () => fetchMedia(services, provider, source));
}
