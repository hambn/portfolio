import type { Services } from './contracts.js';
import { CORS, json } from './lib/http.js';
import { rewriteMedia } from './media/sources.js';
import { handle as spotify } from './providers/spotify.js';
import { handle as steam } from './providers/steam.js';
import { handle as discord } from './providers/discord.js';
import { handle as linkedin } from './providers/linkedin.js';
import { handle as telegram } from './providers/telegram.js';
import { handle as gitlab } from './providers/gitlab.js';
import { handle as github } from './providers/github.js';
import { handle as media } from './media/handler.js';

const providers: Record<
  string,
  (request: Request, services: Services) => Promise<Response | null>
> = { spotify, steam, discord, linkedin, telegram, github, gitlab, media };

export async function handleRequest(request: Request, services: Services): Promise<Response> {
  const incoming = new URL(request.url);
  const prefix = incoming.pathname.startsWith('/api/') ? '/api' : '';
  const url = new URL(incoming);
  if (prefix) url.pathname = url.pathname.slice(prefix.length);
  const providerName = url.pathname.split('/')[1];
  const provider = Object.hasOwn(providers, providerName) ? providers[providerName] : undefined;
  let response: Response;
  try {
    if (!provider && url.pathname !== '/health') response = json({ error: 'not found' }, 404);
    else if (request.method === 'OPTIONS') response = new Response(null, { headers: CORS });
    else if (!['GET', 'HEAD'].includes(request.method)) {
      response = json({ error: 'method not allowed' }, 405);
      response.headers.set('Allow', 'GET, HEAD, OPTIONS');
    } else if (url.pathname === '/health') response = json({ ok: true });
    else {
      // Handlers build the GET representation so HEAD never poisons a cache entry.
      response =
        (await provider!(new Request(url, { headers: request.headers }), services)) ??
        json({ error: 'not found' }, 404);
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const body = await response.text();
        const parsed: unknown = JSON.parse(body);
        const rewritten = rewriteMedia(parsed, prefix || incoming.origin);
        // Payloads without media URLs come back by reference, so they skip a
        // full re-serialisation of the upstream body.
        response = new Response(rewritten === parsed ? body : JSON.stringify(rewritten), response);
        response.headers.delete('Content-Length');
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
