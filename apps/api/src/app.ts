import type { Services } from './contracts.js';
import { CORS, json, readBytes } from './lib/http.js';
import { rewriteMedia } from '@portfolio/shared/media';
import { allowedMethods, matchRoute } from './routes.js';

// The only route that accepts a body accepts a small one; the cap lives here so
// no handler can be reached with an unbounded upload behind it.
const MAX_REQUEST_BYTES = 16 * 1024;

// Rewriting walks the parsed payload. A body with no upstream image URL and no
// API-relative image path has nothing to rewrite, so skip the parse entirely.
function mayCarryMedia(body: string): boolean {
  return body.includes('https://') || body.includes('/avatar') || body.includes('/banner');
}

export async function handleRequest(request: Request, services: Services): Promise<Response> {
  const incoming = new URL(request.url);
  const prefix = incoming.pathname.startsWith('/api/') ? '/api' : '';
  const url = new URL(incoming);
  if (prefix) url.pathname = url.pathname.slice(prefix.length);
  const route = matchRoute(url.pathname);
  const allowed = route ? allowedMethods(route) : 'GET, HEAD, OPTIONS';
  let response: Response;
  try {
    if (!route && url.pathname !== '/health') response = json({ error: 'not found' }, 404);
    else if (request.method === 'OPTIONS')
      response = new Response(null, {
        headers: {
          ...CORS,
          'Access-Control-Allow-Methods': allowed,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    else if (!allowed.split(', ').includes(request.method)) {
      response = json({ error: 'method not allowed' }, 405);
      response.headers.set('Allow', allowed);
    } else if (url.pathname === '/health') response = json({ ok: true });
    else {
      // Handlers build the GET representation so HEAD never poisons a cache entry.
      const body =
        request.method === 'POST'
          ? request.body
            ? await readBytes(request, MAX_REQUEST_BYTES)
            : new Uint8Array()
          : null;
      if (request.method === 'POST' && !body) response = json({ error: 'payload_too_large' }, 413);
      else {
        response = await route!.handler(
          new Request(url, { method: request.method, headers: request.headers, body }),
          services,
        );
        if (response.headers.get('Content-Type')?.includes('application/json')) {
          const text = await response.text();
          if (mayCarryMedia(text)) {
            const parsed: unknown = JSON.parse(text);
            const rewritten = rewriteMedia(parsed, prefix || incoming.origin);
            // Payloads without media URLs come back by reference, so they skip a
            // full re-serialisation of the upstream body.
            response = new Response(
              rewritten === parsed ? text : JSON.stringify(rewritten),
              response,
            );
          } else {
            response = new Response(text, response);
          }
          response.headers.delete('Content-Length');
        }
      }
    }
  } catch (error) {
    console.error(
      'API request failed',
      url.pathname,
      error instanceof Error ? error.message : 'unknown',
    );
    response = json({ error: 'upstream_unavailable' }, 502);
  }
  if (request.method === 'HEAD') {
    await response.body?.pipeTo(new WritableStream());
    return new Response(null, { status: response.status, headers: response.headers });
  }
  return response;
}
