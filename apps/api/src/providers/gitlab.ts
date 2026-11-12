import { z } from 'zod';
import { calendarDays, gitlabPaths, GITLAB_ORIGIN } from '@portfolio/shared/gitlab';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { fetchWithTimeout, readJSON, json } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { persistedResponse, readPersisted } from '../lib/persisted.js';
import { PROFILE_TTL } from '../lib/ttl.js';

const users = z.array(z.looseObject({ username: z.string(), avatar_url: z.string().nullable() }));
// GitLab's calendar: `{ "YYYY-MM-DD": count }`, days without activity left out.
const calendar = z.record(z.string(), z.number());

async function get<T extends z.ZodType>(services: Services, path: string, schema: T) {
  const response = await fetchWithTimeout(services, `${GITLAB_ORIGIN}${path}`, {
    headers: { 'User-Agent': 'portfolio-api', Accept: 'application/json' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`gitlab_${response.status}`);
  }
  return readJSON(response, schema);
}

export async function handle(request: Request, services: Services) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || identities.gitlab;
  if (username !== identities.gitlab) return json({ error: 'gitlab_username_not_configured' }, 400);
  // routes.ts only dispatches /gitlab and /gitlab/contributions here.
  const contributions = url.pathname === '/gitlab/contributions';
  return withCache(services, request, async () => {
    // See providers/github.ts: the last good copy outlives a GitLab outage.
    if (!contributions) {
      const value = await readPersisted(services, {
        key: `gitlab:/gitlab:${username}`,
        ttl: PROFILE_TTL,
        schema: users,
        load: () => get(services, gitlabPaths.users(username), users),
      });
      return persistedResponse(services, value, PROFILE_TTL, 'gitlab_unavailable');
    }
    // The calendar is not readable cross-origin, so this route is the only way
    // the card can draw the account's real activity. Stored raw and shaped per
    // response, so the year always ends on today.
    const value = await readPersisted(services, {
      key: `gitlab:/gitlab/contributions:${username}`,
      ttl: PROFILE_TTL,
      schema: calendar,
      load: () => get(services, gitlabPaths.calendar(username), calendar),
    });
    if (!value) return json({ error: 'gitlab_unavailable' }, 502);
    const days = calendarDays(value.data, services.now());
    return persistedResponse(
      services,
      {
        ...value,
        data: {
          total: { lastYear: days.reduce((sum, day) => sum + day.count, 0) },
          contributions: days,
        },
      },
      PROFILE_TTL,
      'gitlab_unavailable',
    );
  });
}
