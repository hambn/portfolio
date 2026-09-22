import { z } from 'zod';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { fetchWithTimeout, readJSON, json } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { PROFILE_TTL } from '../lib/ttl.js';
const contributions = z.looseObject({
  contributions: z.array(
    z.object({ date: z.string(), count: z.number(), level: z.number().min(0).max(4) }),
  ),
});
const profile = z.looseObject({ login: z.string(), avatar_url: z.string() });
const repositories = z.array(z.looseObject({ id: z.number(), name: z.string() }));
export async function handle(request: Request, services: Services) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || identities.github;
  if (username !== identities.github) return json({ error: 'github_username_not_configured' }, 400);
  const name = encodeURIComponent(username);
  const routes = {
    '/github/contributions': {
      url: `https://github-contributions-api.jogruber.de/v4/${name}?y=last`,
      schema: contributions,
    },
    '/github': { url: `https://api.github.com/users/${name}`, schema: profile },
    '/github/repos': {
      url: `https://api.github.com/users/${name}/repos?sort=updated&type=public&per_page=30`,
      schema: repositories,
    },
  };
  // routes.ts only dispatches the three paths above here.
  const route = routes[url.pathname as keyof typeof routes];
  return withCache(services, request, async () => {
    const response = await fetchWithTimeout(services, route.url, {
      headers: { 'User-Agent': 'portfolio-api', Accept: 'application/json' },
    });
    if (!response.ok) return json({ error: 'github_unavailable' }, 502);
    return json(await readJSON(response, route.schema), 200, PROFILE_TTL);
  });
}
