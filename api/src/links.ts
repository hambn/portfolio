import type { Services } from './contracts.js';
import { json } from './lib/http.js';
import { PROFILE_TTL } from './lib/ttl.js';
import { handle as spotify } from './providers/spotify.js';
import { handle as steam } from './providers/steam.js';
import { handle as discord } from './providers/discord.js';
import { handle as linkedin } from './providers/linkedin.js';
import { handle as x } from './providers/x.js';
import { handle as telegram } from './providers/telegram.js';
import { handle as gitlab } from './providers/gitlab.js';
import { handle as github } from './providers/github.js';

type Handler = (request: Request, services: Services) => Promise<Response | null>;

// One request that answers every card on the links page. Each entry delegates
// to the provider handler that already serves its single-card route, so
// per-card caches, TTLs, cooldowns and snapshot rules are exactly the ones
// those routes use — a batch call warms the same cache entries and never
// duplicates provider logic. Deliberately does not include '/links' itself.
//
// `seedTtl` is only for routes that answer `no-store` from a snapshot the cron
// rotates hourly: the HTTP response is deliberately uncacheable, but the payload
// itself is an hourly snapshot, so the client may hold it that long. It changes
// nothing about the single-card routes — it is advice carried in the envelope.
const cards: Record<string, { path: string; handler: Handler; seedTtl?: number }> = {
  discord: { path: '/discord', handler: discord },
  telegram: { path: '/telegram', handler: telegram, seedTtl: PROFILE_TTL },
  x: { path: '/x', handler: x, seedTtl: PROFILE_TTL },
  github: { path: '/github', handler: github },
  githubContributions: { path: '/github/contributions', handler: github },
  gitlab: { path: '/gitlab', handler: gitlab },
  linkedin: { path: '/linkedin', handler: linkedin, seedTtl: PROFILE_TTL },
  spotify: { path: '/spotify', handler: spotify },
  steam: { path: '/steam', handler: steam },
};

interface Card {
  maxAge: number;
  data?: unknown;
  error?: string;
}

function errorCode(body: unknown, status: number): string {
  const code = (body as { error?: unknown })?.error;
  return typeof code === 'string' ? code : `http_${status}`;
}

async function loadCard(
  key: string,
  request: Request,
  services: Services,
): Promise<[string, Card]> {
  const { path, handler, seedTtl } = cards[key];
  try {
    // The sub-path carries no username: every provider defaults to the account
    // it is configured for, so a batch cannot be steered at another account.
    const url = new URL(path, request.url);
    const response = await handler(new Request(url, { headers: request.headers }), services);
    if (!response) return [key, { maxAge: 0, error: 'not_found' }];
    const body = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* A non-JSON card body is reported as an error below. */
    }
    if (response.status !== 200)
      return [key, { maxAge: 0, error: errorCode(parsed, response.status) }];
    const maxAge = Number(
      /max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '')?.[1] || 0,
    );
    return [key, { maxAge: maxAge || seedTtl || 0, data: parsed }];
  } catch (error) {
    // One unhealthy provider degrades its own card, never the whole page.
    console.warn('Batch card failed', key, error instanceof Error ? error.message : 'unknown');
    return [key, { maxAge: 0, error: 'upstream_unavailable' }];
  }
}

function selection(url: URL): string[] {
  const list = (name: string) =>
    (url.searchParams.get(name) || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => Object.hasOwn(cards, value));
  const include = list('include');
  const exclude = new Set(list('exclude'));
  const keys = include.length ? include : Object.keys(cards);
  return keys.filter((key) => !exclude.has(key));
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const keys = selection(new URL(request.url));
  const results = await Promise.all(keys.map((key) => loadCard(key, request, services)));
  // Uncached: the envelope carries live Spotify playback. Each card still
  // reports its own max-age so the client knows when that card goes stale.
  return json({ generatedAt: services.now(), cards: Object.fromEntries(results) });
}
