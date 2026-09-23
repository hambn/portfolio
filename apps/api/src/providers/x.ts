import { xUsername } from '@portfolio/shared/x';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { allowedHost, json, readBytes, fetchAllowed } from '../lib/http.js';
import {
  PROFILE_HEADERS,
  cachedImage,
  downloadImages,
  imagePath,
  imageResponse,
  parseSnapshot,
  pendingResponse,
  refreshWithCooldown,
  snapshotExpired,
  storedImage,
} from '../lib/snapshot.js';
import { stripHtml, metaContent, htmlAttributes, decodeHtml } from '../lib/html.js';
import { z } from 'zod';

export const configuredXUsername = identities.x;
const cacheKey = (username: string) => `x:profile:v1:${username}`;
const imageSchema = storedImage.nullable();
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
const allowedProfile = allowedHost(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);

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

async function readXSnapshot(services: Services): Promise<Snapshot | null> {
  if (!configuredXUsername) return null;
  const snapshot = parseSnapshot(
    await services.state.get(cacheKey(configuredXUsername)),
    snapshotSchema,
  );
  return snapshot?.profile.username === configuredXUsername ? snapshot : null;
}

export async function refreshX(services: Services): Promise<Snapshot | undefined> {
  if (!configuredXUsername) return;
  const response = await fetchAllowed(
    services,
    `https://x.com/${configuredXUsername}`,
    allowedProfile,
    { headers: PROFILE_HEADERS },
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('X profile fetch failed');
  }
  const bytes = await readBytes(response, 2 * 1024 * 1024);
  const profile = bytes && parseXProfile(new TextDecoder().decode(bytes), configuredXUsername);
  if (!profile) throw new Error('X profile HTML unavailable');
  const previous = await readXSnapshot(services);
  const images = await downloadImages(services, 'x', profile, previous?.images, {
    headers: PROFILE_HEADERS,
  });
  const snapshot = { profile, images, updatedAt: new Date(services.now()).toISOString() };
  await services.state.put(cacheKey(configuredXUsername), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  if (!configuredXUsername) return json({ error: 'x_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && xUsername(requested) !== configuredXUsername)
    return json({ error: 'x_username_not_configured' }, 400);
  const kind = url.pathname.match(/\/(avatar|banner)\/?$/)?.[1] as 'avatar' | 'banner' | undefined;
  return kind
    ? cachedImage(services, request, `/x/${kind}`, () => respond(services, kind))
    : respond(services);
}

async function respond(services: Services, kind?: 'avatar' | 'banner'): Promise<Response> {
  const snapshot =
    (await readXSnapshot(services)) ??
    (await refreshWithCooldown(services, `x:retry:${configuredXUsername}`, () =>
      refreshX(services),
    ));
  if (!snapshot || snapshotExpired(services, snapshot.updatedAt))
    return pendingResponse({ error: 'x_cache_pending' });
  if (kind) {
    const image = snapshot.images[kind];
    if (!image) return json({ error: 'x_image_unavailable' }, 404);
    return imageResponse(image, snapshot.updatedAt);
  }
  return json({
    ...snapshot.profile,
    avatar: imagePath('x', snapshot, 'avatar'),
    banner: imagePath('x', snapshot, 'banner'),
    updatedAt: snapshot.updatedAt,
  });
}
