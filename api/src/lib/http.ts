import type { Services } from '../contracts.js';
import { z } from 'zod';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
};

export function json(data: unknown, status = 200, ttl = 0): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': ttl > 0 ? `public, max-age=${ttl}` : 'no-store',
      ...(ttl > 0
        ? {
            'Cloudflare-CDN-Cache-Control': `public, max-age=${ttl}`,
            'CDN-Cache-Control': `public, max-age=${ttl}`,
          }
        : {}),
    },
  });
}

export function fetchWithTimeout(
  services: Services,
  url: string | URL,
  init: RequestInit = {},
  ms = 6000,
) {
  return services.fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

export async function readBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(response.headers.get('Content-Length')) > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJSON<T extends z.ZodType>(
  response: Response,
  schema: T,
): Promise<z.output<T>> {
  const bytes = await readBytes(response, 2 * 1024 * 1024);
  if (!bytes) throw new Error('upstream_body_invalid');
  return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}

// Check every redirect before fetching it, rather than validating only the final URL.
export async function fetchAllowed(
  services: Services,
  source: string,
  allowed: (url: string) => boolean,
  init: RequestInit = {},
) {
  let url = source;
  const signal = AbortSignal.timeout(10000);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!allowed(url)) throw new Error('upstream_url_not_allowed');
    const response = await services.fetch(url, { ...init, redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('Location');
    await response.body?.cancel();
    if (!location) throw new Error('upstream_redirect_invalid');
    url = new URL(location, url).href;
  }
  throw new Error('upstream_redirect_limit');
}
