import type { Services } from './contracts.js';
import { json } from './lib/http.js';
import { DISCORD_TTL, PROFILE_TTL, STEAM_TTL } from './lib/ttl.js';
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
// `seedTtl` is how long a client may hold this card, and it is the authority
// rather than the sub-response's Cache-Control: a zone-level Browser Cache TTL
// rewrites the header on cached responses (Discord came back as 14400 instead
// of 60), and a card must never be advertised as fresher than its own refresh
// cadence. The header still applies when it is shorter — a cached entry part
// way through its life reports the remainder. Snapshot routes answer no-store
// but rotate hourly, so their seed is an hour. Spotify's playback is live: 0.
const cards: Record<string, { path: string; handler: Handler; seedTtl: number }> = {
  discord: { path: '/discord', handler: discord, seedTtl: DISCORD_TTL },
  telegram: { path: '/telegram', handler: telegram, seedTtl: PROFILE_TTL },
  x: { path: '/x', handler: x, seedTtl: PROFILE_TTL },
  github: { path: '/github', handler: github, seedTtl: PROFILE_TTL },
  githubContributions: { path: '/github/contributions', handler: github, seedTtl: PROFILE_TTL },
  gitlab: { path: '/gitlab', handler: gitlab, seedTtl: PROFILE_TTL },
  linkedin: { path: '/linkedin', handler: linkedin, seedTtl: PROFILE_TTL },
  spotify: { path: '/spotify', handler: spotify, seedTtl: 0 },
  steam: { path: '/steam', handler: steam, seedTtl: STEAM_TTL },
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
    return [key, { maxAge: maxAge ? Math.min(maxAge, seedTtl) : seedTtl, data: parsed }];
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
