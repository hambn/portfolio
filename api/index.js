// ═══════════════════════════════════════════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════════════════════════════════════════

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

const json = (data, status = 200, ttl = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS,
      ...(ttl > 0 ? { 'Cache-Control': `public, max-age=${ttl}` } : {}),
    },
  });

// version param busts cache on deploy — pass env.CACHE_VERSION from every handler
async function withCache(request, fn, version) {
  const cache = caches.default;
  const key = new Request(`${request.url}?__v=${version}`);
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
//  Routes:  /spotify  /spotify/status  /spotify/profile
//           /spotify/favorites?type=tracks|artists&range=short_term|medium_term|long_term
//           /spotify/recent
// ═══════════════════════════════════════════════════════════════════════════

// Access token cached in KV (global, avoids per-DC race from CF Cache)
async function getSpotifyToken(env) {
  const cached = await env.SPOTIFY_KV.get('access_token');
  if (cached) return { access_token: cached };

  const refreshToken = (await env.SPOTIFY_KV.get('refresh_token')) ?? env.SPOTIFY_REFRESH_TOKEN;

  const res = await fetch('https://accounts.spotify.com/api/token', {
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
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204) return null;
  return res.json();
}

async function handleSpotify(pathname, searchParams, request, env) {
  const v = env.CACHE_VERSION;

  // GET /spotify — everything in one request, all fetched in parallel
  if (pathname === '/spotify') {
    const token = await getSpotifyToken(env);
    if (token.error) return json(token, 401);

    const [status, profile, topTracks, topArtists, recent, following, playlists] = await Promise.all([
      spotifyGet('/me/player/currently-playing', token.access_token),
      spotifyGet('/me', token.access_token),
      spotifyGet('/me/top/tracks?time_range=medium_term&limit=10', token.access_token),
      spotifyGet('/me/top/artists?time_range=medium_term&limit=10', token.access_token),
      spotifyGet('/me/player/recently-played?limit=10', token.access_token),
      spotifyGet('/me/following?type=artist&limit=1', token.access_token),
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
      id:           contextRaw.id,
      name:         contextRaw.name,
      description:  contextRaw.description,
      images:       contextRaw.images,
      url:          contextRaw.external_urls?.spotify,
      followers:    contextRaw.followers?.total ?? 0,
      totalTracks:  contextRaw.tracks?.total ?? 0,
      previewTracks: contextRaw.tracks?.items?.slice(0, 5).map(i => i.track).filter(Boolean),
    } : null;

    return json({
      status:        { ...(status ?? { playing: false }), contextPlaylist },
      profile,
      followingCount: following?.artists?.total ?? 0,
      topTracks,
      topArtists,
      recent,
      playlists: playlists?.items?.filter(p => p.owner?.id === profile?.id && p.public) ?? [],
    });
  }

  // GET /spotify/status — real-time, no cache
  if (pathname === '/spotify/status') {
    const token = await getSpotifyToken(env);
    if (token.error) return json(token, 401);
    return json((await spotifyGet('/me/player/currently-playing', token.access_token)) ?? { playing: false });
  }

  // GET /spotify/profile — cache 1h
  if (pathname === '/spotify/profile') {
    return withCache(request, async () => {
      const token = await getSpotifyToken(env);
      if (token.error) return json(token, 401);
      return json(await spotifyGet('/me', token.access_token), 200, 3600);
    }, v);
  }

  // GET /spotify/favorites?type=tracks|artists&range=short_term|medium_term|long_term — cache 1h
  if (pathname === '/spotify/favorites') {
    return withCache(request, async () => {
      const type = searchParams.get('type') ?? 'tracks';
      const range = searchParams.get('range') ?? 'medium_term';
      const token = await getSpotifyToken(env);
      if (token.error) return json(token, 401);
      return json(
        await spotifyGet(`/me/top/${type}?time_range=${range}&limit=10`, token.access_token),
        200,
        3600,
      );
    }, v);
  }

  // GET /spotify/recent — cache 5m
  if (pathname === '/spotify/recent') {
    return withCache(request, async () => {
      const token = await getSpotifyToken(env);
      if (token.error) return json(token, 401);
      return json(
        await spotifyGet('/me/player/recently-played?limit=10', token.access_token),
        200,
        300,
      );
    }, v);
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
    header:  `${base}/header.jpg`,
    capsule: `${base}/capsule_231x87.jpg`,
    hero:    `${base}/library_hero.jpg`,
    logo:    `${base}/logo.png`,
  };
}

async function steamGet(path, params, apiKey) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
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

    const vanityMatch = player.profileurl?.match(/steamcommunity\.com\/id\/([^/]+)\//);
    const username    = vanityMatch ? vanityMatch[1] : null;
    const favoriteRaw = [...allGames].sort((a, b) => b.playtime_forever - a.playtime_forever)[0];
    const currentGame = player.gameid
      ? { appid: player.gameid, name: player.gameextrainfo, images: steamGameImages(player.gameid) }
      : null;

    return json({
      displayName: player.personaname,
      realName:    player.realname ?? null,
      username,
      steamId:     player.steamid,
      profileUrl:  player.profileurl,
      avatar: {
        small:  player.avatar,
        medium: player.avatarmedium,
        large:  player.avatarfull,
      },
      status:      STEAM_STATUS[player.personastate] ?? 'Offline',
      level,
      country:     player.loccountrycode ?? null,
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
  if (pathname !== '/discord') return null;

  return withCache(request, async () => {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`);
    const { success, data } = await res.json();

    if (!success) return json({ error: 'lanyard_failed' }, 200, 60);

    const user = data.discord_user;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number(user.id) % 5}.png`;

    return json({
      username:    user.username,
      displayName: user.global_name ?? user.username,
      id:          user.id,
      avatar:      avatarUrl,
      status:      data.discord_status,         // online | idle | dnd | offline
      activeOn: {
        desktop: data.active_on_discord_desktop,
        mobile:  data.active_on_discord_mobile,
        web:     data.active_on_discord_web,
      },
      activities:       data.activities,         // games, custom status, etc.
      listeningSpotify: data.listening_to_spotify,
      spotify:          data.spotify,            // null or { song, artist, album, album_art_url, ... }
    }, 200, 60);
  }, env.CACHE_VERSION);
}


// ═══════════════════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const { pathname, searchParams } = new URL(request.url);

    if (pathname.startsWith('/spotify'))  return (await handleSpotify(pathname, searchParams, request, env)) ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/steam'))    return (await handleSteam(pathname, request, env))    ?? json({ error: 'not found' }, 404);
    if (pathname.startsWith('/discord'))  return (await handleDiscord(pathname, request, env))  ?? json({ error: 'not found' }, 404);

    return json({ error: 'not found' }, 404);
  },
};
