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
  const res = await fetchWithTimeout(
    services,
    `https://api.spotify.com/v1${path}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    10000,
  );
  if (res.status === 204) return null;
  return readJSON(res, spotifyData);
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

    const [status, profile, topTracks, topArtists, recent, playlists] = await Promise.all([
      spotifyGet(services, '/me/player/currently-playing', token.access_token),
      spotifyGet(services, '/me', token.access_token),
      spotifyGet(services, '/me/top/tracks?time_range=medium_term&limit=10', token.access_token),
      spotifyGet(services, '/me/top/artists?time_range=medium_term&limit=10', token.access_token),
      spotifyGet(services, '/me/player/recently-played?limit=10', token.access_token),
      spotifyGet(services, '/me/playlists?limit=50', token.access_token),
    ]);

    // Fetch context playlist details if currently playing from one
    const contextId =
      status?.context?.type === 'playlist' ? status.context.uri.split(':').pop() : null;

    const contextRaw = contextId
      ? await spotifyGet(services, `/playlists/${contextId}`, token.access_token)
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
