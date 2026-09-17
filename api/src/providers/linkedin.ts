import links from '../../../public/contents/links/links.json' with { type: 'json' };
import { linkedinUsername } from '../../../shared/linkedin.js';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from '../lib/http.js';
import { linkedinProfileSchema, parseLinkedInProfile } from './linkedin-html.js';
import { allowedMedia } from '../media/sources.js';
import { z } from 'zod';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html',
};
export const configuredLinkedInUsername = linkedinUsername(
  links.linkedin.handle || links.linkedin.url,
);
const cacheKey = (username: string) => `linkedin:profile:v1:${username}`;
const imageSchema = z.object({ contentType: z.string(), data: z.string() }).nullable();
const snapshotSchema = z.object({
  profile: linkedinProfileSchema,
  images: z.object({ avatar: imageSchema, banner: imageSchema }),
  updatedAt: z.string().datetime(),
});
type Snapshot = z.infer<typeof snapshotSchema>;
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
  if (!configuredLinkedInUsername) return null;
  const raw = await services.state.get(cacheKey(configuredLinkedInUsername));
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw || 'null'));
    return result.success && result.data.profile.username === configuredLinkedInUsername
      ? result.data
      : null;
  } catch {
    return null;
  }
}

export async function refreshLinkedIn(services: Services): Promise<Snapshot | undefined> {
  if (!configuredLinkedInUsername) return;
  const profileUrl = `https://www.linkedin.com/in/${configuredLinkedInUsername}/`;
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
    throw new Error('LinkedIn profile fetch failed');
  }
  const bytes = await readBytes(response, 2 * 1024 * 1024);
  const profile =
    bytes && parseLinkedInProfile(new TextDecoder().decode(bytes), configuredLinkedInUsername);
  if (!profile) throw new Error('LinkedIn profile HTML unavailable');
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
          headers: HEADERS,
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
  await services.state.put(cacheKey(configuredLinkedInUsername), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/linkedin(?:\/(avatar|banner))?\/?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!configuredLinkedInUsername) return json({ error: 'linkedin_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && linkedinUsername(requested) !== configuredLinkedInUsername)
    return json({ error: 'linkedin_username_not_configured' }, 400);
  let snapshot = await readLinkedInSnapshot(services);
  if (!snapshot) {
    const cooldown = `linkedin:retry:${configuredLinkedInUsername}`;
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
    const response = json({ error: 'linkedin_cache_pending' }, 503);
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
