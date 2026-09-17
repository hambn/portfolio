import type { Services } from '../contracts.js';
import { json, fetchWithTimeout, readJSON } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { steamData } from '../lib/schemas.js';

const STEAM_STATUS = [
  'Offline',
  'Online',
  'Busy',
  'Away',
  'Snooze',
  'Looking to Trade',
  'Looking to Play',
];

function steamGameImages(appid: string | number) {
  const base = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}`;
  return {
    header: `${base}/header.jpg`,
    hero: `${base}/library_hero.jpg`,
  };
}

async function steamGet(
  services: Services,
  path: string,
  params: Record<string, string | number | boolean>,
  apiKey: string,
) {
  const url = new URL(`https://api.steampowered.com/${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  // One flaky endpoint must not discard the endpoints that did answer, so
  // failures resolve to null and the caller degrades that section instead.
  try {
    const res = await fetchWithTimeout(services, url);
    if (!res.ok) return null;
    return await readJSON(res, steamData);
  } catch (error) {
    console.warn(
      'Steam endpoint unavailable',
      path,
      error instanceof Error ? error.message : 'unknown',
    );
    return null;
  }
}

export async function handle(request: Request, services: Services) {
  const { pathname } = new URL(request.url);
  if (pathname !== '/steam') return null;
  if (!services.config.STEAM_API_KEY || !/^\d+$/.test(services.config.STEAM_ID))
    return json({ error: 'steam_not_configured' }, 503);

  // GET /steam — profile + level + current game + favorite game + recent activity
  return withCache(services, request, async () => {
    const key = services.config.STEAM_API_KEY;
    const steamId = services.config.STEAM_ID;

    const [summaryData, levelData, recentData, ownedData] = await Promise.all([
      steamGet(services, 'ISteamUser/GetPlayerSummaries/v2', { steamids: steamId }, key),
      steamGet(services, 'IPlayerService/GetSteamLevel/v1', { steamid: steamId }, key),
      steamGet(
        services,
        'IPlayerService/GetRecentlyPlayedGames/v1',
        { steamid: steamId, count: 10 },
        key,
      ),
      steamGet(
        services,
        'IPlayerService/GetOwnedGames/v1',
        {
          steamid: steamId,
          include_appinfo: true,
          include_played_free_games: true,
        },
        key,
      ),
    ]);

    const player = summaryData?.response?.players?.[0];
    if (!player) throw new Error('steam_profile_missing');
    const level = levelData?.response?.player_level ?? 0;
    const allGames = ownedData?.response?.games ?? [];
    const recentGames = recentData?.response?.games ?? [];

    const favoriteRaw = [...allGames].sort((a, b) => b.playtime_forever - a.playtime_forever)[0];
    const currentGame = player.gameid
      ? { appid: player.gameid, name: player.gameextrainfo, images: steamGameImages(player.gameid) }
      : null;

    return json(
      {
        displayName: player.personaname,
        profileUrl: player.profileurl,
        avatar: {
          small: player.avatar,
          medium: player.avatarmedium,
          large: player.avatarfull,
        },
        status: STEAM_STATUS[player.personastate] ?? 'Offline',
        level,
        memberSince: player.timecreated
          ? new Date(player.timecreated * 1000).toISOString().slice(0, 10)
          : null,
        totalGames: allGames.length,
        currentGame,
        favoriteGame: favoriteRaw
          ? {
              appid: favoriteRaw.appid,
              name: favoriteRaw.name,
              playtime_hours: +(favoriteRaw.playtime_forever / 60).toFixed(1),
              images: steamGameImages(favoriteRaw.appid),
            }
          : null,
        recentActivity: recentGames.map((g) => ({
          appid: g.appid,
          name: g.name,
          playtime_2weeks_hours: +(g.playtime_2weeks / 60).toFixed(1),
          playtime_total_hours: +(g.playtime_forever / 60).toFixed(1),
          images: steamGameImages(g.appid),
        })),
      },
      200,
      300,
    );
  });
}
