import { telegramUsername } from '@portfolio/shared/telegram';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import { allowedHost, json, readBytes, fetchAllowed } from '../lib/http.js';
import {
  PROFILE_HEADERS,
  cachedImage,
  downloadImage,
  imageResponse,
  parseSnapshot,
  pendingResponse,
  refreshWithCooldown,
  snapshotExpired,
  storedImage,
} from '../lib/snapshot.js';
import { stripHtml, metaContent, htmlAttributes, decodeHtml } from '../lib/html.js';
import { allowedMedia } from '@portfolio/shared/media';
import { z } from 'zod';

export const configuredTelegramUsername = identities.telegram;
const cacheKey = (username: string) => `telegram:profile:v1:${username}`;
const allowedProfile = allowedHost(['t.me']);
const snapshotSchema = z.object({
  profile: z.looseObject({ username: z.string(), photo: z.string().nullable() }),
  image: storedImage.nullable(),
  updatedAt: z.string().datetime(),
});
type Snapshot = z.infer<typeof snapshotSchema>;

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
    response = await fetchAllowed(services, profileUrl, allowedProfile, {
      headers: PROFILE_HEADERS,
    });
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

  const bytes = await readBytes(response, 256 * 1024);
  if (!bytes) return null;
  const html = new TextDecoder().decode(bytes);

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
  const contact = telegramElementText(html, 'tgme_page_additional');

  return {
    username,
    handle: username,
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
    title: htmlTitle(html) || `Telegram: Contact @${username}`,
  };
}

async function readTelegramSnapshot(services: Services): Promise<Snapshot | null> {
  if (!configuredTelegramUsername) return null;
  return parseSnapshot(
    await services.state.get(cacheKey(configuredTelegramUsername)),
    snapshotSchema,
  );
}

export async function refreshTelegram(services: Services): Promise<Snapshot | undefined> {
  const username = configuredTelegramUsername;
  if (!username) return;
  const profile = await fetchTelegramProfile(services, username);
  if (!profile) throw new Error('Telegram profile fetch failed');
  const previous = await readTelegramSnapshot(services);
  let image: Snapshot['image'] = null;
  if (profile.photo && allowedMedia('telegram', profile.photo)) {
    // Keep a previously downloaded photo when the CDN is temporarily unavailable.
    image =
      (await downloadImage(
        services,
        'telegram',
        profile.photo,
        { headers: PROFILE_HEADERS },
        1024 * 1024,
      )) ??
      previous?.image ??
      null;
  }
  const snapshot = { profile, image, updatedAt: new Date(services.now()).toISOString() };
  await services.state.put(cacheKey(username), JSON.stringify(snapshot));
  return snapshot;
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  if (!configuredTelegramUsername) return json({ error: 'telegram_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && telegramUsername(requested) !== configuredTelegramUsername)
    return json({ error: 'telegram_username_not_configured' }, 400);
  return /\/avatar\/?$/.test(url.pathname)
    ? cachedImage(services, request, '/telegram/avatar', () => respond(services, true))
    : respond(services, false);
}

async function respond(services: Services, avatar: boolean): Promise<Response> {
  const snapshot =
    (await readTelegramSnapshot(services)) ??
    (await refreshWithCooldown(services, `telegram:retry:${configuredTelegramUsername}`, () =>
      refreshTelegram(services),
    ));
  if (!snapshot || snapshotExpired(services, snapshot.updatedAt))
    return pendingResponse({ error: 'telegram_cache_pending' });
  const { profile, image, updatedAt } = snapshot;
  if (avatar) {
    if (!image) return json({ error: 'telegram_photo_unavailable' }, 404);
    return imageResponse(image);
  }
  const photo = `/telegram/avatar?username=${encodeURIComponent(profile.username)}&v=${encodeURIComponent(updatedAt)}`;
  return json({ ...profile, photo: image ? photo : null, updatedAt });
}
