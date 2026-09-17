import links from '../../../public/contents/links/links.json' with { type: 'json' };
import { xUsername } from '../../../shared/x.js';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from '../lib/http.js';
import { stripHtml, metaContent, htmlAttributes, decodeHtml } from '../lib/html.js';
import { allowedMedia } from '../media/sources.js';
import { z } from 'zod';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
export const configuredXUsername = xUsername(links.x.handle || links.x.url);
const cacheKey = (username: string) => `x:profile:v1:${username}`;
const imageSchema = z.object({ contentType: z.string(), data: z.string() }).nullable();
const profileSchema = z.object({
  username: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  banner: z.string().nullable(),
  website: z.string().nullable(),
  websiteLabel: z.string().nullable(),
  joined: z.string().nullable(),
  posts: z.string().nullable(),
  followers: z.string().nullable(),
  following: z.string().nullable(),
  url: z.string(),
});
const snapshotSchema = z.object({
  profile: profileSchema,
  images: z.object({ avatar: imageSchema, banner: imageSchema }),
  updatedAt: z.string().datetime(),
});
type Snapshot = z.infer<typeof snapshotSchema>;
const MAX_STALE_MS = 7 * 86400000;
const allowedProfile = (source: string) => {
  const url = new URL(source);
  return (
    url.protocol === 'https:' &&
    ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) &&
    !url.port &&
    !url.username &&
    !url.password
  );
};

// Parse the public, server-rendered profile. Never evaluate X's hydration scripts.
export function parseXProfile(html: string, username: string) {
  if (xUsername(metaContent(html, 'profile:username')) !== username) return null;
  const title = metaContent(html, 'og:title');
  const name = title?.replace(/\s*\(@[^)]+\)\s*(?:on X|\/ X)\s*$/, '').trim();
  if (!name || name === title) return null;
  const description = metaContent(html, 'og:description') || '';
  const count = (label: string) =>
    description.match(new RegExp(`([\\d,.]+[KMB]?)\\s+${label}`, 'i'))?.[1] || null;
  const images = (html.match(/<img\b[^>]*>/gi) || []).map((tag) =>
    decodeHtml(htmlAttributes(tag).src || ''),
  );
  // Restrict website discovery to the profile header, before its relationship counts.
  const header = html.split(new RegExp(`href=["']/${username}/following["']`, 'i'))[0];
  const anchors = [...header.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const websiteAnchor = anchors.find((match) =>
    /^https:\/\/t\.co\//.test(decodeHtml(htmlAttributes(match[1]).href || '')),
  );
  const website = websiteAnchor ? decodeHtml(htmlAttributes(websiteAnchor[1]).href) : null;
  const labelled = (label: string) => {
    for (let i = 1; i <= 4; i++) {
      if (metaContent(html, `twitter:label${i}`)?.toLowerCase() === label)
        return metaContent(html, `twitter:data${i}`);
    }
    return null;
  };
  return {
    username,
    name,
    description: metaContent(html, 'twitter:description'),
    avatar: metaContent(html, 'og:image'),
    banner: images.find((src) => src.startsWith('https://pbs.twimg.com/profile_banners/')) || null,
    website,
    websiteLabel: websiteAnchor ? stripHtml(websiteAnchor[2]) : null,
    joined: labelled('joined'),
    posts: labelled('posts'),
    followers: count('followers'),
    following: count('following'),
    url: `https://x.com/${username}`,
  };
}

export async function readXSnapshot(services: Services): Promise<Snapshot | null> {
  if (!configuredXUsername) return null;
  const raw = await services.state.get(cacheKey(configuredXUsername));
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw || 'null'));
    return result.success && result.data.profile.username === configuredXUsername
      ? result.data
      : null;
  } catch {
    return null;
  }
}

export async function refreshX(services: Services): Promise<Snapshot | undefined> {
  if (!configuredXUsername) return;
  const response = await fetchAllowed(
    services,
    `https://x.com/${configuredXUsername}`,
    allowedProfile,
    { headers: HEADERS },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('X profile fetch failed');
  }
  const bytes = await readBytes(response, 2 * 1024 * 1024);
  const profile = bytes && parseXProfile(new TextDecoder().decode(bytes), configuredXUsername);
  if (!profile) throw new Error('X profile HTML unavailable');
  const previous = await readXSnapshot(services);
  const images: Snapshot['images'] = { avatar: null, banner: null };
  for (const kind of ['avatar', 'banner'] as const) {
    const source = profile[kind];
    if (!source || !allowedMedia('x', source)) continue;
    try {
      const imageResponse = await fetchAllowed(services, source, (url) => allowedMedia('x', url), {
        headers: HEADERS,
      });
      const contentType = imageResponse.headers.get('Content-Type')?.split(';')[0] || '';
      if (!imageResponse.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
        await imageResponse.body?.cancel();
        throw new Error('Unexpected X image response');
      }
      const imageBytes = await readBytes(imageResponse, 2 * 1024 * 1024);
      if (!imageBytes) throw new Error('X image exceeds 2 MiB');
      let binary = '';
      for (let offset = 0; offset < imageBytes.length; offset += 8192)
        binary += String.fromCharCode(...imageBytes.subarray(offset, offset + 8192));
      images[kind] = { contentType, data: btoa(binary) };
    } catch {
      images[kind] = previous?.images[kind] ?? null;
    }
  }
  const snapshot = { profile, images, updatedAt: new Date(services.now()).toISOString() };
  await services.state.put(cacheKey(configuredXUsername), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/x(?:\/(avatar|banner))?\/?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!configuredXUsername) return json({ error: 'x_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && xUsername(requested) !== configuredXUsername)
    return json({ error: 'x_username_not_configured' }, 400);
  let snapshot = await readXSnapshot(services);
  if (!snapshot) {
    const cooldown = `x:retry:${configuredXUsername}`;
    if (!(await services.state.get(cooldown))) {
      await services.state.put(cooldown, '1', { expirationTtl: 60 });
      try {
        snapshot = (await refreshX(services)) ?? null;
      } catch {
        /* Retry on the next scheduled refresh. */
      }
    }
  }
  if (!snapshot || services.now() - Date.parse(snapshot.updatedAt) > MAX_STALE_MS) {
    const response = json({ error: 'x_cache_pending' }, 503);
    response.headers.set('Retry-After', '60');
    return response;
  }
  const { profile, images, updatedAt } = snapshot;
  if (match[1]) {
    const image = images[match[1] as 'avatar' | 'banner'];
    if (!image) return json({ error: 'x_image_unavailable' }, 404);
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
      ? `/x/${kind}?username=${profile.username}&v=${encodeURIComponent(updatedAt)}`
      : null;
  return json({ ...profile, avatar: imagePath('avatar'), banner: imagePath('banner'), updatedAt });
}
