import links from '../public/contents/links/links.json' with { type: 'json' };
import { telegramUsername } from '../shared/telegram.js';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
const TELEGRAM_HEADERS = { ...HEADERS, Accept: 'text/html' };
const fetchWithTimeout = (url, init = {}, ms = 10000) =>
  fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(ms) });
export const configuredTelegramUsername = telegramUsername(
  links.telegram?.url || links.telegram?.username || links.telegram?.handle,
);
const cacheKey = (username) => `telegram:profile:v1:${username}`;
const CORS = { 'Access-Control-Allow-Origin': '*' };
const REFRESH_COOLDOWN_MS = 60 * 1000;
let refreshInFlight = null;
let lastRefreshAttempt = 0;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

function decodeHtml(value) {
  return String(value ?? '')
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/gi,
      (entity) =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&nbsp;': ' ',
        })[entity.toLowerCase()] ?? entity,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const value =
        code[0].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10);
      if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return _;
      try {
        return String.fromCodePoint(value);
      } catch {
        return _;
      }
    });
}

function stripHtml(value) {
  return decodeHtml(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[ \t\r\f]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function htmlAttributes(tag) {
  const attrs = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(tag))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  return attrs;
}

// Telegram has used both property/name and different attribute orders over
// time. Reading the complete meta tag keeps the scraper tolerant of either.
function metaContent(html, key) {
  const wanted = key.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = htmlAttributes(tag);
    if ((attrs.property || attrs.name || '').toLowerCase() === wanted && attrs.content != null) {
      return decodeHtml(attrs.content).trim() || null;
    }
  }
  return null;
}

function telegramElementText(html, className) {
  const re = new RegExp(
    `<([a-z][\\w-]*)[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    'i',
  );
  const text = stripHtml(html.match(re)?.[2]);
  return text || null;
}

function htmlTitle(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return stripHtml(title) || null;
}

function telegramPhoto(html) {
  const photo = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');
  if (photo) return photo.startsWith('//') ? `https:${photo}` : photo;
  const block = html.match(
    /class=["'][^"']*\btgme_page_photo\b[^"']*["'][\s\S]*?<img\b[^>]*>/i,
  )?.[0];
  const src = block ? htmlAttributes(block).src : null;
  const value = src ? decodeHtml(src).trim() : '';
  return value ? (value.startsWith('//') ? `https:${value}` : value) : null;
}

async function readBytes(response, maxBytes) {
  const length = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > maxBytes) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

// Only proxy Telegram-owned media. The username is validated, but the public
// page can still contain arbitrary metadata, so this also prevents an open
// image proxy if Telegram changes its HTML.
function telegramPhotoSource(value) {
  let candidate = String(value ?? '').trim();
  if (!candidate) return null;
  if (candidate.startsWith('//')) candidate = `https:${candidate}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;

  const hostname = parsed.hostname.toLowerCase();
  const telegramHost =
    hostname === 'telesco.pe' ||
    hostname.endsWith('.telesco.pe') ||
    hostname === 'telegram.org' ||
    hostname.endsWith('.telegram.org');
  return telegramHost ? parsed.toString() : null;
}

async function fetchTelegramProfile(username) {
  const profileUrl = `https://t.me/${username}`;
  let response;
  try {
    response = await fetchWithTimeout(profileUrl, { headers: TELEGRAM_HEADERS }, 10000);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let html;
  try {
    const bytes = await readBytes(response, 256 * 1024);
    html = bytes ? new TextDecoder().decode(bytes) : null;
  } catch {
    return null;
  }
  if (html == null) return null;

  const title = telegramElementText(html, 'tgme_page_title');
  if (!title) return null;
  const pageExtra = telegramElementText(html, 'tgme_page_extra');
  const pageDescription = telegramElementText(html, 'tgme_page_description');
  const description = pageDescription;
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

// The scheduler owns normal refreshes. A cold public request can bootstrap the
// first snapshot so a new deployment is usable before its first cron window.
// Keep the last successful value indefinitely so upstream outages do not blank the card.
export async function refreshTelegram(env) {
  const username = configuredTelegramUsername;
  if (!username) return;
  const profile = await fetchTelegramProfile(username);
  if (!profile) throw new Error('Telegram profile fetch failed');
  let image = null;
  const source = telegramPhotoSource(profile.photo);
  if (source) {
    try {
      const response = await fetchWithTimeout(source, { headers: HEADERS });
      const contentType = response.headers.get('Content-Type')?.split(';')[0];
      if (!response.ok || !/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
        throw new Error('unexpected avatar response');
      }
      const bytes = await readBytes(response, 1024 * 1024);
      if (!bytes) throw new Error('avatar exceeds 1 MiB');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      }
      image = { contentType, data: btoa(binary) };
    } catch (error) {
      // A temporary CDN problem should not discard valid profile metadata.
      console.warn('Telegram avatar refresh failed:', error?.message || String(error));
    }
  }
  await env.SPOTIFY_KV.put(
    cacheKey(username),
    JSON.stringify({
      profile,
      image,
      updatedAt: new Date().toISOString(),
    }),
  );
}

async function readTelegramSnapshot(env) {
  if (!configuredTelegramUsername || !env?.SPOTIFY_KV?.get) return null;
  const raw = await env.SPOTIFY_KV.get(cacheKey(configuredTelegramUsername));
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw);
    if (!snapshot?.profile?.username || !snapshot.updatedAt) return null;
    return snapshot;
  } catch {
    return null;
  }
}

async function ensureTelegramSnapshot(env) {
  let snapshot = await readTelegramSnapshot(env);
  if (snapshot) return snapshot;

  // The first request after deployment should not make visitors wait for the
  // first cron window. Coalesce concurrent cold-start requests and throttle
  // retries while Telegram or KV is unavailable.
  const now = Date.now();
  if (!refreshInFlight && now - lastRefreshAttempt >= REFRESH_COOLDOWN_MS) {
    lastRefreshAttempt = now;
    refreshInFlight = refreshTelegram(env).finally(() => {
      refreshInFlight = null;
    });
  }
  if (refreshInFlight) {
    try {
      await refreshInFlight;
    } catch (error) {
      console.warn('Telegram profile refresh failed:', error?.message || String(error));
    }
  }
  snapshot = await readTelegramSnapshot(env);
  return snapshot;
}

export async function handleTelegram(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/telegram(?:\/(avatar))?\/?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  if (!configuredTelegramUsername) return json({ error: 'telegram_not_configured' }, 503);
  const requested = url.searchParams.get('username');
  if (requested && telegramUsername(requested) !== configuredTelegramUsername) {
    return json({ error: 'telegram_username_not_configured' }, 400);
  }
  const snapshot = await ensureTelegramSnapshot(env);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: 'telegram_cache_pending' }), {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }
  const { profile, image, updatedAt } = snapshot;
  if (match[1]) {
    if (!image) return json({ error: 'telegram_photo_unavailable' }, 404);
    const bytes = Uint8Array.from(atob(image.data), (character) => character.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        ...CORS,
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  const photo = new URL('/telegram/avatar', url.origin);
  photo.searchParams.set('username', profile.username);
  photo.searchParams.set('v', updatedAt);
  const response = json({
    ...profile,
    photo: image ? `${photo.pathname}${photo.search}` : null,
    updatedAt,
  });
  return request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response;
}
