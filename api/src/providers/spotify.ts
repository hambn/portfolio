import type { Services } from '../contracts.js';
import { json, fetchWithTimeout, readJSON, CORS } from '../lib/http.js';
import { spotifyData, tokenData } from '../lib/schemas.js';

async function getSpotifyToken(services: Services) {
  const cached = await services.state.get('access_token');
  if (cached) return { access_token: cached };

  const refreshToken =
    (await services.state.get('refresh_token')) ?? services.config.SPOTIFY_REFRESH_TOKEN;

  if (!refreshToken || !services.config.SPOTIFY_CLIENT_ID)
    throw new Error('spotify_not_configured');

  const res = await fetchWithTimeout(services, 'https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken || '',
      client_id: services.config.SPOTIFY_CLIENT_ID,
    }),
  });
  const data = await readJSON(res, tokenData);

  if (!data.error && data.access_token) {
    if (data.refresh_token) await services.state.put('refresh_token', data.refresh_token);
    await services.state.put('access_token', data.access_token, { expirationTtl: 3300 });
  }

  if (!data.error && !data.access_token) throw new Error('spotify_invalid_token');
  return data;
}

async function spotifyGet(services: Services, path: string, accessToken: string | undefined) {
  try {
    const res = await fetchWithTimeout(
      services,
      `https://api.spotify.com/v1${path}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      10000,
    );
    if (res.status === 204) return { data: null, status: res.status };

    try {
      const data = await readJSON(res, spotifyData);
      return { data, status: res.status };
    } catch (error) {
      // Spotify occasionally answers a single endpoint with an empty or
      // non-JSON body (for example while rate limiting). Keep the other
      // library requests usable instead of failing the whole aggregate call.
      return {
        data: null,
        status: res.status,
        error: error instanceof Error ? error.message : 'invalid_response',
      };
    }
  } catch (error) {
    return {
      data: null,
      status: 0,
      error: error instanceof Error ? error.message : 'request_failed',
    };
  }
}

export async function handle(request: Request, services: Services) {
  const { pathname } = new URL(request.url);
  // Playback is intentionally uncached and independent of slower library requests.
  if (pathname === '/spotify' && new URL(request.url).searchParams.get('playback') === '1') {
    const token = await getSpotifyToken(services);
    if (token.error) return json(token, 401);
    const response = await fetchWithTimeout(
      services,
      'https://api.spotify.com/v1/me/player/currently-playing',
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
      },
    );
    const headers: Record<string, string> = {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'Retry-After',
    };
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401) await services.state.delete('access_token');
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter) headers['Retry-After'] = retryAfter;
      return new Response(JSON.stringify({ error: 'Spotify playback unavailable' }), {
        status: response.status,
        headers,
      });
    }
    const status =
      response.status === 204
        ? { is_playing: false, item: null }
        : await readJSON(response, spotifyData);
    return new Response(JSON.stringify({ status, playbackOnly: true }), { headers });
  }
  // GET /spotify — everything in one request, all fetched in parallel
  if (pathname === '/spotify') {
    const token = await getSpotifyToken(services);
    if (token.error) return json(token, 401);

    const endpointResults = await Promise.all(
      [
        ['status', '/me/player/currently-playing'] as const,
        ['profile', '/me'] as const,
        ['topTracks', '/me/top/tracks?time_range=medium_term&limit=10'] as const,
        ['topArtists', '/me/top/artists?time_range=medium_term&limit=10'] as const,
        ['recent', '/me/player/recently-played?limit=10'] as const,
        ['playlists', '/me/playlists?limit=50'] as const,
      ].map(async ([name, path]) => ({
        name,
        result: await spotifyGet(services, path, token.access_token),
      })),
    );

    const unauthorized = endpointResults.find(({ result }) => result.status === 401);
    if (unauthorized) {
      await services.state.delete('access_token');
      return json({ error: 'spotify_unauthorized' }, 401);
    }

    for (const { name, result } of endpointResults) {
      if (result.error || ![200, 204].includes(result.status)) {
        console.warn('Spotify endpoint unavailable', name, result.status || 'network');
      }
    }

    const values = Object.fromEntries(
      endpointResults.map(({ name, result }) => [name, result.data]),
    ) as Record<string, Awaited<ReturnType<typeof spotifyGet>>['data']>;
    const status = values.status;
    const profile = values.profile;
    const topTracks = values.topTracks;
    const topArtists = values.topArtists;
    const recent = values.recent;
    const playlists = values.playlists;

    // Fetch context playlist details if currently playing from one
    const contextId =
      status?.context?.type === 'playlist' && typeof status.context.uri === 'string'
        ? status.context.uri.split(':').pop()
        : null;

    const contextRaw = contextId
      ? (await spotifyGet(services, `/playlists/${contextId}`, token.access_token)).data
      : null;

    const contextPlaylist = contextRaw
      ? {
          id: contextRaw.id,
          name: contextRaw.name,
          images: contextRaw.images,
          url: contextRaw.external_urls?.spotify,
          totalTracks: contextRaw.tracks?.total ?? 0,
        }
      : null;

    return json({
      status: { ...(status ?? { playing: false }), contextPlaylist },
      profile,
      topTracks,
      topArtists,
      recent,
      playlists: playlists?.items?.filter((p) => p.owner?.id === profile?.id && p.public) ?? [],
    });
  }

  return null;
}
