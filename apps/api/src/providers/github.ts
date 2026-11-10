import { z } from 'zod';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { fetchWithTimeout, readJSON, json } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { persistedResponse, readPersisted } from '../lib/persisted.js';
import { PROFILE_TTL } from '../lib/ttl.js';

const contributions = z.looseObject({
  contributions: z.array(
    z.object({ date: z.string(), count: z.number(), level: z.number().min(0).max(4) }),
  ),
});
const profile = z.looseObject({ login: z.string(), avatar_url: z.string() });

/**
 * Headers for api.github.com. Anonymous calls share a 60/hour budget per
 * address, which a Worker shares with every other Worker on that address; an
 * optional read-only GITHUB_TOKEN lifts it to 5000/hour.
 */
export function githubHeaders(services: Services): Record<string, string> {
  return {
    'User-Agent': 'portfolio-api',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(services.config.GITHUB_TOKEN
      ? { Authorization: `Bearer ${services.config.GITHUB_TOKEN}` }
      : {}),
  };
}

export async function handle(request: Request, services: Services) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || identities.github;
  if (username !== identities.github) return json({ error: 'github_username_not_configured' }, 400);
  const name = encodeURIComponent(username);
  const routes = {
    '/github/contributions': {
      url: `https://github-contributions-api.jogruber.de/v4/${name}?y=last`,
      headers: { 'User-Agent': 'portfolio-api', Accept: 'application/json' },
      schema: contributions,
    },
    '/github': {
      url: `https://api.github.com/users/${name}`,
      headers: githubHeaders(services),
      schema: profile,
    },
  };
  // routes.ts only dispatches the two paths above here.
  const route = routes[url.pathname as keyof typeof routes];
  return withCache(services, request, async () => {
    // Kept in state as well as the response cache: once a card has loaded, a
    // GitHub outage or rate limit serves the last good copy instead of a 502.
    const value = await readPersisted(services, {
      key: `github:${url.pathname}:${username}`,
      ttl: PROFILE_TTL,
      schema: route.schema,
      load: async () => {
        const response = await fetchWithTimeout(services, route.url, { headers: route.headers });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`github_${response.status}`);
        }
        return readJSON(response, route.schema);
      },
    });
    return persistedResponse(services, value, PROFILE_TTL, 'github_unavailable');
  });
}
