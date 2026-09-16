// ═══════════════════════════════════════════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════════════════════════════════════════

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' };

// Hard deadline for every upstream call — one slow API must not stall the request.
const fetchWithTimeout = (url, init = {}, ms = 6000) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(ms) });

const json = (data, status = 200, ttl = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS,
      ...(ttl > 0
        ? {
            'Cache-Control': `public, max-age=${ttl}`,
            'Cloudflare-CDN-Cache-Control': `public, max-age=${ttl}`,
            'CDN-Cache-Control': `public, max-age=${ttl}`,
          }
        : {}),
    },
  });

// Version param busts cache on deploy. Handlers can pass a canonical path when
// their response varies by a query parameter.
async function withCache(request, fn, version, cachePath) {
  const cache = caches.default;
  const { origin, pathname } = new URL(request.url);
  const key = new Request(
    `${origin}${cachePath || pathname}?__v=${encodeURIComponent(version ?? '0')}`,
  );
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fn();
  if (res.status === 200) await cache.put(key, res.clone());
  return res;
}


// ═══════════════════════════════════════════════════════════════════════════
//  SPOTIFY
//  Secret:  SPOTIFY_CLIENT_ID  (wrangler secret put SPOTIFY_CLIENT_ID)
//  KV:      SPOTIFY_KV         (stores rotating access_token + refresh_token)
//  Routes:  /spotify
// ═══════════════════════════════════════════════════════════════════════════

// Access token cached in KV (global, avoids per-DC race from CF Cache)
async function getSpotifyToken(env) {
  const cached = await env.SPOTIFY_KV.get('access_token');
  if (cached) return { access_token: cached };

  const refreshToken = (await env.SPOTIFY_KV.get('refresh_token')) ?? env.SPOTIFY_REFRESH_TOKEN;

  const res = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.SPOTIFY_CLIENT_ID,
    }),
  });
  const data = await res.json();

  if (!data.error) {
    if (data.refresh_token) await env.SPOTIFY_KV.put('refresh_token', data.refresh_token);
    await env.SPOTIFY_KV.put('access_token', data.access_token, { expirationTtl: 3300 });
  }

  return data;
}

async function spotifyGet(path, accessToken) {
  const res = await fetchWithTimeout(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 10000);
  if (res.status === 204) return null;
  return res.json();
}

async function handleSpotify(pathname, env, request) {
  // Playback is intentionally uncached and independent of slower library requests.
  if (pathname === '/spotify' && new URL(request.url).searchParams.get('playback') === '1') {
    const token = await getSpotifyToken(env);
    if (token.error) return json(token, 401);
    const response = await fetchWithTimeout('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const headers = { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'Retry-After' };
    if (!response.ok) {
      if (response.status === 401) await env.SPOTIFY_KV.delete('access_token');
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) headers['Retry-After'] = retryAfter;
      return new Response(JSON.stringify({ error: 'Spotify playback unavailable' }), { status: response.status, headers });
    }
    const status = response.status === 204 ? { is_playing: false, item: null } : await response.json();
    return new Response(JSON.stringify({ status, playbackOnly: true }), { headers });
  }
  // GET /spotify — everything in one request, all fetched in parallel
  if (pathname === '/spotify') {
    const token = await getSpotifyToken(env);
    if (token.error) return json(token, 401);

    const [status, profile, topTracks, topArtists, recent, playlists] = await Promise.all([
      spotifyGet('/me/player/currently-playing', token.access_token),
      spotifyGet('/me', token.access_token),
      spotifyGet('/me/top/tracks?time_range=medium_term&limit=10', token.access_token),
      spotifyGet('/me/top/artists?time_range=medium_term&limit=10', token.access_token),
      spotifyGet('/me/player/recently-played?limit=10', token.access_token),
      spotifyGet('/me/playlists?limit=50', token.access_token),
    ]);

    // Fetch context playlist details if currently playing from one
    const contextId = status?.context?.type === 'playlist'
      ? status.context.uri.split(':').pop()
      : null;

    const contextRaw = contextId
      ? await spotifyGet(`/playlists/${contextId}`, token.access_token)
      : null;

    const contextPlaylist = contextRaw ? {
      id:          contextRaw.id,
      name:        contextRaw.name,
      images:      contextRaw.images,
      url:         contextRaw.external_urls?.spotify,
      totalTracks: contextRaw.tracks?.total ?? 0,
    } : null;

    return json({
      status:        { ...(status ?? { playing: false }), contextPlaylist },
      profile,
      topTracks,
      topArtists,
      recent,
      playlists: playlists?.items?.filter(p => p.owner?.id === profile?.id && p.public) ?? [],
    });
  }

  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
//  STEAM
//  Secret:  STEAM_API_KEY  (wrangler secret put STEAM_API_KEY)
//           Get key at: https://steamcommunity.com/dev/apikey
//  Config:  STEAM_ID — your 64-bit Steam ID (find at https://steamid.io)
//  Routes:  /steam
// ═══════════════════════════════════════════════════════════════════════════

const STEAM_STATUS = ['Offline', 'Online', 'Busy', 'Away', 'Snooze', 'Looking to Trade', 'Looking to Play'];

function steamGameImages(appid) {
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}`;
  return {
    header: `${base}/header.jpg`,
    hero:   `${base}/library_hero.jpg`,
  };
}

async function steamGet(path, params, apiKey) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchWithTimeout(url);
  return res.json();
}

async function handleSteam(pathname, request, env) {
  if (pathname !== '/steam') return null;

  // GET /steam — profile + level + current game + favorite game + recent activity
  return withCache(request, async () => {
    const key = env.STEAM_API_KEY;
    const steamId = env.STEAM_ID;

    const [summaryData, levelData, recentData, ownedData] = await Promise.all([
      steamGet('ISteamUser/GetPlayerSummaries/v2', { steamids: steamId }, key),
      steamGet('IPlayerService/GetSteamLevel/v1',  { steamid: steamId }, key),
      steamGet('IPlayerService/GetRecentlyPlayedGames/v1', { steamid: steamId, count: 10 }, key),
      steamGet('IPlayerService/GetOwnedGames/v1', {
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true,
      }, key),
    ]);

    const player      = summaryData?.response?.players?.[0] ?? {};
    const level       = levelData?.response?.player_level ?? 0;
    const allGames    = ownedData?.response?.games ?? [];
    const recentGames = recentData?.response?.games ?? [];

    const favoriteRaw = [...allGames].sort((a, b) => b.playtime_forever - a.playtime_forever)[0];
    const currentGame = player.gameid
      ? { appid: player.gameid, name: player.gameextrainfo, images: steamGameImages(player.gameid) }
      : null;

    return json({
      displayName: player.personaname,
      profileUrl:  player.profileurl,
      avatar: {
        small:  player.avatar,
        medium: player.avatarmedium,
        large:  player.avatarfull,
      },
      status:      STEAM_STATUS[player.personastate] ?? 'Offline',
      level,
      memberSince: player.timecreated
        ? new Date(player.timecreated * 1000).toISOString().slice(0, 10)
        : null,
      totalGames:  allGames.length,
      currentGame,
      favoriteGame: favoriteRaw ? {
        appid:          favoriteRaw.appid,
        name:           favoriteRaw.name,
        playtime_hours: +(favoriteRaw.playtime_forever / 60).toFixed(1),
        images:         steamGameImages(favoriteRaw.appid),
      } : null,
      recentActivity: recentGames.map(g => ({
        appid:                g.appid,
        name:                 g.name,
        playtime_2weeks_hours: +(g.playtime_2weeks / 60).toFixed(1),
        playtime_total_hours:  +(g.playtime_forever / 60).toFixed(1),
        images:               steamGameImages(g.appid),
      })),
    }, 200, 300);
  }, env.CACHE_VERSION);
}


// ═══════════════════════════════════════════════════════════════════════════
//  DISCORD
//  Uses Lanyard API (free) — requires joining discord.gg/lanyard once
//  Config:  DISCORD_ID — your Discord user ID
//  Routes:  /discord
//  Cache:   60s (real-time presence)
// ═══════════════════════════════════════════════════════════════════════════

async function handleDiscord(pathname, request, env) {
  if (pathname === '/discord/avatar') {
    // proxied through our own domain + edge cache, so the browser never hits discordapp.com
    return withCache(request, async () => {
      const res = await fetchWithTimeout(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`);
      const { success, data } = await res.json();
      if (!success) return new Response(null, { status: 502 });

      const user = data.discord_user;
      const cdnUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

      const img = await fetchWithTimeout(cdnUrl);
      return new Response(img.body, {
        status: img.status,
        headers: {
          'Content-Type': img.headers.get('Content-Type') ?? 'image/png',
          ...CORS,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }, env.CACHE_VERSION);
  }

  if (pathname !== '/discord') return null;

  return withCache(request, async () => {
    const res = await fetchWithTimeout(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`);
    const { success, data } = await res.json();

    if (!success) return json({ error: 'lanyard_failed' }, 200, 60);

    const user = data.discord_user;

    return json({
      username:    user.username,
      displayName: user.global_name ?? user.username,
      id:          user.id,
      avatar:      `${new URL(request.url).origin}/discord/avatar`,
      status:      data.discord_status,         // online | idle | dnd | offline
      activities:  data.activities,             // games, custom status, etc.
    }, 200, 60);
  }, env.CACHE_VERSION);
}


// ═══════════════════════════════════════════════════════════════════════════
//  LINKEDIN
//  No public API for personal profiles — scrape the public profile page's
//  OG meta tags instead. Cached hard (1h, via Cache API) so we don't hammer
//  linkedin.com; a scrape failure falls back to the last good cache entry.
//  Config:  LINKEDIN_URL — public profile URL, e.g. https://linkedin.com/in/hambn
//  Routes:  /linkedin
// ═══════════════════════════════════════════════════════════════════════════

const LINKEDIN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
};

// Only ever fetch a real https://*.linkedin.com URL from env — never an
// arbitrary string that could point anywhere.
function linkedinProfileUrl(env) {
  if (!env.LINKEDIN_URL) return null;
  try {
    const u = new URL(env.LINKEDIN_URL);
    if (u.protocol !== 'https:') return null;
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

// LinkedIn blocks a bare request with HTTP 999 — it only serves the page once
// the client presents session cookies (bcookie/li_gc/JSESSIONID) issued by a
// prior visit. So: warm up with one request to collect Set-Cookie, then
// replay with those cookies attached.
async function fetchLinkedInHtml(url) {
  const warmup = await fetchWithTimeout(url, { headers: LINKEDIN_HEADERS }, 10000);
  const cookie = warmup.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');

  const res = await fetchWithTimeout(url, { headers: { ...LINKEDIN_HEADERS, Cookie: cookie } }, 10000);
  if (!res.ok) return null;
  return res.text();
}

async function handleLinkedIn(pathname, request, env) {
  if (pathname !== '/linkedin') return null;

  const profileUrl = linkedinProfileUrl(env);
  if (!profileUrl) return json({ error: 'linkedin_not_configured' }, 503);

  return withCache(request, async () => {
    const html = await fetchLinkedInHtml(profileUrl);
    if (!html) return json({ error: 'linkedin_fetch_failed' }, 200, 300);
    const title = metaContent(html, 'og:title') ?? '';
    // og:title is usually "Name - Headline | LinkedIn"
    const [name, headline] = title.replace(/\s*\|\s*LinkedIn$/i, '').split(/\s+-\s+/, 2);

    return json({
      name:     name?.trim() || null,
      headline: headline?.trim() || null,
      avatar:   metaContent(html, 'og:image'),
      url:      metaContent(html, 'og:url') ?? profileUrl,
    }, 200, 3600);
  }, env.CACHE_VERSION);
}


// ═══════════════════════════════════════════════════════════════════════════
//  TELEGRAM
//  Telegram's public t.me pages include profile data in their HTML metadata.
//  Config:  username query parameter, e.g. /telegram?username=ham_bn
//  Routes:  /telegram, /telegram/avatar
//  Cache:   1h (profile metadata changes infrequently)
// ═══════════════════════════════════════════════════════════════════════════

// Public fallback for the profile shown by the portfolio. The Worker var in
// wrangler.toml is the deploy-time source of truth and can override this for a
// different profile; keeping a fallback makes the self-host adapter useful too.
const DEFAULT_TELEGRAM_USERNAME = 'ham_bn';

const TELEGRAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/149.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const TELEGRAM_IMAGE_HEADERS = {
  'User-Agent': TELEGRAM_HEADERS['User-Agent'],
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': TELEGRAM_HEADERS['Accept-Language'],
};

// Telegram usernames may be written as "@name" in config. Accepting a full
// t.me URL too is convenient, but the request below is always rebuilt from the
// validated username so this endpoint cannot be used as an open proxy.
function telegramUsername(value) {
  if (value == null) return null;
  let candidate = String(value).trim();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      if (!/(^|\.)t\.me$/i.test(parsed.hostname)) return null;
      candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }
  candidate = candidate.replace(/^@/, '').trim();
  return /^[A-Za-z0-9_]{5,32}$/.test(candidate) ? candidate.toLowerCase() : null;
}

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

async function readTelegramHtml(response, maxBytes = 256 * 1024) {
  const length = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > maxBytes) return null;
  if (!response.body?.getReader) {
    const text = await response.text();
    return text.length <= maxBytes ? text : null;
  }

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
  return new TextDecoder().decode(bytes);
}

function telegramPhotoProxy(requestUrl, username) {
  const url = new URL('/telegram/avatar', requestUrl.origin);
  url.searchParams.set('username', username);
  return url.toString();
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
    html = await readTelegramHtml(response);
  } catch {
    return null;
  }
  if (html == null) return null;

  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    telegramElementText(html, 'tgme_page_title');
  const pageExtra = telegramElementText(html, 'tgme_page_extra');
  const pageDescription = telegramElementText(html, 'tgme_page_description');
  const description =
    metaContent(html, 'og:description') ||
    metaContent(html, 'twitter:description') ||
    pageDescription;
  const photo = telegramPhoto(html);
  const displayUsername =
    pageExtra?.match(/@?([A-Za-z0-9_]{5,32})/)?.[1]?.toLowerCase() || username;
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
    siteName: metaContent(html, 'og:site_name') || 'Telegram',
    title: htmlTitle(html) || `Telegram: Contact @${displayUsername}`,
  };
}

function telegramRequestedUsername(pathname, requestUrl, env, prefix) {
  return telegramUsername(
    requestUrl.searchParams.get('username') ||
      requestUrl.searchParams.get('handle') ||
      pathname.slice(prefix.length) ||
      env?.TELEGRAM_USERNAME ||
      env?.TELEGRAM_HANDLE ||
      env?.TELEGRAM_URL ||
      DEFAULT_TELEGRAM_USERNAME,
  );
}

async function handleTelegram(pathname, request, env) {
  if (pathname !== '/telegram' && !pathname.startsWith('/telegram/')) return null;

  const requestUrl = new URL(request.url);
  const username = telegramRequestedUsername(pathname, requestUrl, env, '/telegram/');
  if (!username) return json({ error: 'telegram_username_invalid' }, 400);

  return withCache(
    request,
    async () => {
      const profile = await fetchTelegramProfile(username);
      if (!profile) return json({ error: 'telegram_fetch_failed' }, 502);

      const photo = profile.photo ? telegramPhotoProxy(requestUrl, username) : null;
      return json(
        {
          ...profile,
          photo,
          // avatar is kept as an alias so consumers can use the same shape as the
          // other profile cards. photoSource is used by the cached image proxy.
          avatar: photo,
          photoSource: profile.photo,
        },
        200,
        3600,
      );
    },
    env.CACHE_VERSION,
    `/telegram/${username}`,
  );
}

async function handleTelegramAvatar(pathname, request, env) {
  const prefix = '/telegram/avatar/';
  if (pathname !== '/telegram/avatar' && !pathname.startsWith(prefix)) return null;

  const requestUrl = new URL(request.url);
  const username = telegramRequestedUsername(pathname, requestUrl, env, prefix);
  if (!username) return json({ error: 'telegram_username_invalid' }, 400);

  return withCache(
    request,
    async () => {
      // Reuse the one-hour profile cache so the image request does not cause a
      // second t.me scrape during the same refresh window.
      const profileRequest = new Request(`${requestUrl.origin}/telegram/${username}`, {
        headers: request.headers,
      });
      const profileResponse = await handleTelegram(`/telegram/${username}`, profileRequest, env);
      if (!profileResponse || profileResponse.status !== 200) {
        return json({ error: 'telegram_photo_unavailable' }, 404);
      }

      const profile = await profileResponse.json();
      const source = telegramPhotoSource(profile.photoSource || profile.photo);
      if (!source) return json({ error: 'telegram_photo_unavailable' }, 404);

      let response;
      try {
        response = await fetchWithTimeout(source, { headers: TELEGRAM_IMAGE_HEADERS }, 10000);
      } catch {
        return json({ error: 'telegram_photo_fetch_failed' }, 502);
      }
      if (!response.ok) return json({ error: 'telegram_photo_fetch_failed' }, 502);

      const contentType = response.headers.get('Content-Type') || '';
      if (!/^image\//i.test(contentType)) {
        return json({ error: 'telegram_photo_fetch_failed' }, 502);
      }
      const length = Number(response.headers.get('Content-Length'));
      if (Number.isFinite(length) && length > 10 * 1024 * 1024) {
        return json({ error: 'telegram_photo_too_large' }, 502);
      }

      const headers = new Headers({
        'Content-Type': contentType,
        ...CORS,
        'Cache-Control': 'public, max-age=3600',
        'Cloudflare-CDN-Cache-Control': 'public, max-age=3600',
        'CDN-Cache-Control': 'public, max-age=3600',
      });
      for (const name of ['Content-Length', 'ETag', 'Last-Modified']) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(response.body, { status: 200, headers });
    },
    env.CACHE_VERSION,
    `/telegram/avatar/${username}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/health') return json({ ok: true });

    const known = ['/spotify', '/steam', '/discord', '/linkedin', '/telegram']
      .some(route => pathname === route || pathname.startsWith(`${route}/`));
    if (!known) return json({ error: 'not found' }, 404);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'GET, HEAD, OPTIONS', ...CORS },
      });
    }

    if (pathname.startsWith('/spotify'))  return (await handleSpotify(pathname, env, request)) ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/steam'))    return (await handleSteam(pathname, request, env))    ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/discord'))  return (await handleDiscord(pathname, request, env))  ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/linkedin')) return (await handleLinkedIn(pathname, request, env)) ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/telegram/avatar')) return (await handleTelegramAvatar(pathname, request, env)) ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/telegram')) return (await handleTelegram(pathname, request, env)) ?? json({ error: 'not found' }, 404);

    return json({ error: 'not found' }, 404);
  },
};
