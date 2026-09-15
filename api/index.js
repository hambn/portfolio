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
      ...(ttl > 0 ? { 'Cache-Control': `public, max-age=${ttl}` } : {}),
    },
  });

// version param busts cache on deploy — pass env.CACHE_VERSION from every handler.
// Cache key uses origin + pathname only, so query strings share one entry.
async function withCache(request, fn, version) {
  const cache = caches.default;
  const { origin, pathname } = new URL(request.url);
  const key = new Request(`${origin}${pathname}?__v=${version}`);
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

async function handleSpotify(pathname, env) {
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

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
  const raw = html.match(re)?.[1];
  return raw ? raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null;
}

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
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/health') return json({ ok: true });

    const known = ['/spotify', '/steam', '/discord', '/linkedin']
      .some(route => pathname === route || pathname.startsWith(`${route}/`));
    if (!known) return json({ error: 'not found' }, 404);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'GET, HEAD, OPTIONS', ...CORS },
      });
    }

    if (pathname.startsWith('/spotify'))  return (await handleSpotify(pathname, env)) ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/steam'))    return (await handleSteam(pathname, request, env))    ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/discord'))  return (await handleDiscord(pathname, request, env))  ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/linkedin')) return (await handleLinkedIn(pathname, request, env)) ?? json({ error: 'not found' }, 404);

    return json({ error: 'not found' }, 404);
  },
};
