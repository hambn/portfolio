import { z } from 'zod';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { fetchWithTimeout, readJSON, json } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { PROFILE_TTL } from '../lib/ttl.js';
const users = z.array(z.looseObject({ username: z.string(), avatar_url: z.string().nullable() }));
export async function handle(request: Request, services: Services) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || identities.gitlab;
  if (username !== identities.gitlab) return json({ error: 'gitlab_username_not_configured' }, 400);
  return withCache(services, request, async () => {
    const response = await fetchWithTimeout(
      services,
      `https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`,
    );
    if (!response.ok) {
      await response.body?.cancel();
      return json({ error: 'gitlab_unavailable' }, 502);
    }
    return json(await readJSON(response, users), 200, PROFILE_TTL);
  });
}
