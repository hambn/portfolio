import links from '../../../public/contents/links/links.json' with { type: 'json' };
import { telegramUsername } from '../../../shared/telegram.js';
import type { Services } from '../contracts.js';
import { CORS, json, readBytes, fetchAllowed } from '../lib/http.js';
import { stripHtml, metaContent, htmlAttributes, decodeHtml } from '../lib/html.js';
import { allowedMedia } from '../media/sources.js';
import { z } from 'zod';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
export const configuredTelegramUsername = telegramUsername(
  links.telegram.url || links.telegram.handle,
);
const cacheKey = (username: string) => `telegram:profile:v1:${username}`;
const allowedProfile = (source: string) => {
  const url = new URL(source);
  return (
    url.protocol === 'https:' &&
    url.hostname === 't.me' &&
    !url.port &&
    !url.username &&
    !url.password
  );
};
const snapshotSchema = z.object({
  profile: z.looseObject({ username: z.string(), photo: z.string().nullable() }),
  image: z.object({ contentType: z.string(), data: z.string() }).nullable(),
  updatedAt: z.string().datetime(),
});
type Snapshot = z.infer<typeof snapshotSchema>;
const MAX_STALE_MS = 7 * 86400000;

function telegramElementText(html: string, className: string) {
  const re = new RegExp(
    `<([a-z][\\w-]*)[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  );
  const text = stripHtml(html.match(re)?.[2]);
  return text || null;
}

function htmlTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return stripHtml(title) || null;
}

function telegramPhoto(html: string) {
  const photo = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  if (photo) return photo.startsWith('//') ? `https:${photo}` : photo;
  const block = html.match(
    /class=["'][^"']*\btgme_page_photo\b[^"']*["'][\s\S]*?<img\b[^>]*>/i,
  )?.[0];
  const src = block ? htmlAttributes(block).src : null;
  const value = src ? decodeHtml(src).trim() : '';
  return value ? (value.startsWith('//') ? `https:${value}` : value) : null;
}

async function fetchTelegramProfile(services: Services, username: string) {
  const profileUrl = `https://t.me/${username}`;
  let response;
  try {
    response = await fetchAllowed(services, profileUrl, allowedProfile, { headers: HEADERS });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const finalUrl = new URL(response.url || profileUrl);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname.toLowerCase() !== 't.me') return null;
  } catch {
    return null;
  }

  let html;
  try {
    const bytes = await readBytes(response, 256 * 1024);
    html = bytes ? new TextDecoder().decode(bytes) : null;
  } catch {
    return null;
  }
  if (html == null) return null;

  const title =
    telegramElementText(html, 'tgme_page_title') ||
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title');
  if (!title || /^telegram(?:\s*:\s*contact)?$/i.test(title)) return null;
  const pageExtra = telegramElementText(html, 'tgme_page_extra');
  const pageDescription = telegramElementText(html, 'tgme_page_description');
  const description =
    pageDescription ||
    metaContent(html, 'og:description') ||
    metaContent(html, 'twitter:description');
  const photo = telegramPhoto(html);
  const displayUsername = username;
  const contact = telegramElementText(html, 'tgme_page_additional');

  return {
    username: displayUsername,
    handle: displayUsername,
    name: title,
    displayName: title,
    description,
    photo,
    url: profileUrl,
    profileUrl,
    messageUrl: profileUrl,
    contact,
    extra: pageExtra,
    siteName: metaContent(html, 'og:site_name') || 'Telegram',
    title: htmlTitle(html) || `Telegram: Contact @${displayUsername}`,
  };
}

export async function readTelegramSnapshot(services: Services): Promise<Snapshot | null> {
  if (!configuredTelegramUsername) return null;
  const raw = await services.state.get(cacheKey(configuredTelegramUsername));
  if (!raw) return null;
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function refreshTelegram(services: Services): Promise<Snapshot | undefined> {
  const username = configuredTelegramUsername;
  if (!username) return;
  const profile = await fetchTelegramProfile(services, username);
  if (!profile) throw new Error('Telegram profile fetch failed');
  const previous = await readTelegramSnapshot(services);
  let image: Snapshot['image'] = null;
  if (profile.photo && allowedMedia('telegram', profile.photo)) {
    try {
      const response = await fetchAllowed(
        services,
        profile.photo,
        (url) => allowedMedia('telegram', url),
        { headers: HEADERS },
      );
      const contentType = response.headers.get('Content-Type')?.split(';')[0] || '';
      if (!response.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
        await response.body?.cancel();
        throw new Error('unexpected avatar response');
      }
      const bytes = await readBytes(response, 1024 * 1024);
      if (!bytes) throw new Error('avatar exceeds 1 MiB');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      image = { contentType, data: btoa(binary) };
    } catch {
      // Keep a previously downloaded photo when the CDN is temporarily unavailable.
      image = previous?.image ?? null;
    }
  }
  const snapshot = { profile, image, updatedAt: new Date(services.now()).toISOString() };
  await services.state.put(cacheKey(username), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/telegram(?:\/(avatar))?\/?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!configuredTelegramUsername) return json({ error: 'telegram_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && telegramUsername(requested) !== configuredTelegramUsername)
    return json({ error: 'telegram_username_not_configured' }, 400);
  let snapshot = await readTelegramSnapshot(services);
  if (!snapshot) {
    // Persist the cooldown to avoid hammering Telegram across cold Worker instances.
    const cooldown = `telegram:retry:${configuredTelegramUsername}`;
    if (!(await services.state.get(cooldown))) {
      await services.state.put(cooldown, '1', { expirationTtl: 60 });
      try {
        snapshot = (await refreshTelegram(services)) ?? null;
      } catch {
        /* A later request or the scheduler can retry. */
      }
    }
  }
  if (!snapshot || services.now() - Date.parse(snapshot.updatedAt) > MAX_STALE_MS) {
    const response = json({ error: 'telegram_cache_pending' }, 503);
    response.headers.set('Retry-After', '60');
    return response;
  }
  const { profile, image, updatedAt } = snapshot;
  if (match[1]) {
    if (!image) return json({ error: 'telegram_photo_unavailable' }, 404);
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
  const photo = `/telegram/avatar?username=${encodeURIComponent(profile.username)}&v=${encodeURIComponent(updatedAt)}`;
  return json({ ...profile, photo: image ? photo : null, updatedAt });
}
