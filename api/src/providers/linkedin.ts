import links from '../../../public/contents/links/links.json' with { type: 'json' };
import { linkedinUsername } from '../../../shared/linkedin.js';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from '../lib/http.js';
import { linkedinProfileSchema, parseLinkedInProfile } from './linkedin-html.js';
import { allowedMedia } from '../media/sources.js';
import { z } from 'zod';

// Public guest navigation headers, reproduced from a working logged-out request.
// The cookie values are guest placeholders, not account credentials.
const HEADERS = {
  Cookie: 'lang=v; bcookie="v;',
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'max-age=0',
  priority: 'u=0, i',
  referer: 'https://www.google.com/',
  'sec-ch-prefers-color-scheme': 'dark',
  'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
};
const IMAGE_HEADERS = {
  'User-Agent': HEADERS['user-agent'],
  Accept: 'image/avif,image/webp,image/*',
};
export const configuredLinkedInUsername = linkedinUsername(
  links.linkedin.handle || links.linkedin.url,
);
export const linkedInUsernameFor = (services: Services) =>
  services.config.LINKEDIN_URL
    ? linkedinUsername(services.config.LINKEDIN_URL)
    : configuredLinkedInUsername;
const cacheKey = (username: string) => `linkedin:profile:v1:${username}`;
const imageSchema = z.object({ contentType: z.string(), data: z.string() }).nullable();
const snapshotSchema = z.object({
  profile: linkedinProfileSchema,
  images: z.object({ avatar: imageSchema, banner: imageSchema }),
  updatedAt: z.string().datetime(),
});
type Snapshot = z.infer<typeof snapshotSchema>;
const failureKey = (services: Services) => `linkedin:failure:${linkedInUsernameFor(services)}`;
const failureSchema = z.object({
  error: z.enum([
    'linkedin_upstream_blocked',
    'linkedin_fetch_failed',
    'linkedin_profile_unavailable',
  ]),
  upstreamStatus: z.number().int().optional(),
});
type Failure = z.infer<typeof failureSchema>;
class LinkedInFetchError extends Error {
  constructor(readonly failure: Failure) {
    super(failure.error);
  }
}
const MAX_STALE_MS = 7 * 86400000;
const allowedProfile = (source: string) => {
  const url = new URL(source);
  return (
    url.protocol === 'https:' &&
    ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) &&
    !url.port &&
    !url.username &&
    !url.password
  );
};

export async function readLinkedInSnapshot(services: Services): Promise<Snapshot | null> {
  const username = linkedInUsernameFor(services);
  if (!username) return null;
  const raw = await services.state.get(cacheKey(username));
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw || 'null'));
    return result.success && result.data.profile.username === username ? result.data : null;
  } catch {
    return null;
  }
}

export async function refreshLinkedIn(services: Services): Promise<Snapshot | undefined> {
  try {
    const snapshot = await fetchAndCacheLinkedIn(services);
    if (snapshot) await services.state.delete(failureKey(services));
    return snapshot;
  } catch (error) {
    const failure: Failure =
      error instanceof LinkedInFetchError ? error.failure : { error: 'linkedin_fetch_failed' };
    console.warn('LinkedIn refresh failed', failure);
    await services.state.put(failureKey(services), JSON.stringify(failure), {
      expirationTtl: 3600,
    });
    throw error;
  }
}

async function fetchAndCacheLinkedIn(services: Services): Promise<Snapshot | undefined> {
  const username = linkedInUsernameFor(services);
  if (!username) return;
  const profileUrl = `https://www.linkedin.com/in/${username}/`;
  let response = await fetchAllowed(services, profileUrl, allowedProfile, { headers: HEADERS });
  // A public guest response can issue cookies before serving the profile.
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  if ([403, 999].includes(response.status) && cookie) {
    await response.body?.cancel();
    response = await fetchAllowed(services, profileUrl, allowedProfile, {
      headers: { ...HEADERS, Cookie: cookie },
    });
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new LinkedInFetchError({
      error: [403, 429, 999].includes(response.status)
        ? 'linkedin_upstream_blocked'
        : 'linkedin_fetch_failed',
      upstreamStatus: response.status,
    });
  }
  const bytes = await readBytes(response, 2 * 1024 * 1024);
  const profile = bytes && parseLinkedInProfile(new TextDecoder().decode(bytes), username);
  if (!profile) throw new LinkedInFetchError({ error: 'linkedin_profile_unavailable' });
  const previous = await readLinkedInSnapshot(services);
  const images: Snapshot['images'] = { avatar: null, banner: null };
  for (const kind of ['avatar', 'banner'] as const) {
    const source = profile[kind];
    if (!source || !allowedMedia('linkedin', source)) continue;
    try {
      const imageResponse = await fetchAllowed(
        services,
        source,
        (url) => allowedMedia('linkedin', url),
        {
          headers: IMAGE_HEADERS,
        },
      );
      const contentType = imageResponse.headers.get('Content-Type')?.split(';')[0] || '';
      if (!imageResponse.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
        await imageResponse.body?.cancel();
        throw new Error('Unexpected LinkedIn image response');
      }
      const imageBytes = await readBytes(imageResponse, 2 * 1024 * 1024);
      if (!imageBytes) throw new Error('LinkedIn image exceeds 2 MiB');
      let binary = '';
      for (let offset = 0; offset < imageBytes.length; offset += 8192)
        binary += String.fromCharCode(...imageBytes.subarray(offset, offset + 8192));
      images[kind] = { contentType, data: btoa(binary) };
    } catch {
      images[kind] = previous?.images[kind] ?? null;
    }
  }
  const snapshot = { profile, images, updatedAt: new Date(services.now()).toISOString() };
  await services.state.put(cacheKey(username), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/linkedin(?:\/(avatar|banner))?\/?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const username = linkedInUsernameFor(services);
  if (!username) return json({ error: 'linkedin_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && linkedinUsername(requested) !== username)
    return json({ error: 'linkedin_username_not_configured' }, 400);
  let snapshot = await readLinkedInSnapshot(services);
  if (!snapshot) {
    const cooldown = `linkedin:retry:${username}`;
    if (!(await services.state.get(cooldown))) {
      await services.state.put(cooldown, '1', { expirationTtl: 60 });
      try {
        snapshot = (await refreshLinkedIn(services)) ?? null;
      } catch {
        /* Retry on the next scheduled refresh. */
      }
    }
  }
  if (!snapshot || services.now() - Date.parse(snapshot.updatedAt) > MAX_STALE_MS) {
    let failure: Failure | undefined;
    try {
      const parsed = failureSchema.safeParse(
        JSON.parse((await services.state.get(failureKey(services))) || 'null'),
      );
      if (parsed.success) failure = parsed.data;
    } catch {
      /* A missing or invalid failure record is still a pending cache. */
    }
    const response = json(failure || { error: 'linkedin_cache_pending' }, 503);
    response.headers.set('Retry-After', '60');
    return response;
  }
  const { profile, images, updatedAt } = snapshot;
  if (match[1]) {
    const image = images[match[1] as 'avatar' | 'banner'];
    if (!image) return json({ error: 'linkedin_image_unavailable' }, 404);
    return new Response(
      Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0)),
      {
        headers: {
          ...CORS,
          'Content-Type': image.contentType,
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
  const imagePath = (kind: 'avatar' | 'banner') =>
    images[kind]
      ? `/linkedin/${kind}?username=${profile.username}&v=${encodeURIComponent(updatedAt)}`
      : null;
  return json({ ...profile, avatar: imagePath('avatar'), banner: imagePath('banner'), updatedAt });
}
