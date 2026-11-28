// Dynamic oEmbed 1.0 endpoints (`/oembed/spotify`, `/oembed/discord`) so rich
// unfurlers like Discord show live Spotify now-playing tracks and live Discord
// presence right inside the portfolio embed header.
import type { Services } from './contracts.js';
import { identities } from './identities.js';
import { json } from './lib/http.js';
import { handle as spotify } from './providers/spotify.js';
import { handle as discord } from './providers/discord.js';

const SITE = 'https://hgh.dev';

interface SpotifyTrackLike {
  name?: string;
  artists?: { name?: string }[];
  external_urls?: { spotify?: string };
  album?: { images?: { url?: string }[] };
}

interface SpotifyPayload {
  status?: { is_playing?: boolean; item?: SpotifyTrackLike | null } | null;
  recent?: { items?: { track?: SpotifyTrackLike | null }[] } | null;
}

interface DiscordPayload {
  status?: string;
  discord_status?: string;
  activities?: {
    type?: number;
    name?: string;
    details?: string;
    state?: string;
  }[];
}

function trackLabel(track: SpotifyTrackLike | null | undefined): string | null {
  if (!track?.name) return null;
  const artists = (track.artists || [])
    .map((a) => a?.name)
    .filter(Boolean)
    .join(', ');
  return artists ? `${track.name} — ${artists}` : track.name;
}

async function readJsonSafe<T>(call: () => Promise<Response>): Promise<T | null> {
  try {
    const response = await call();
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function handle(request: Request, services: Services): Promise<Response> {
  const url = new URL(request.url);
  const service = url.pathname.replace(/^\/oembed\//, '').replace(/\/+$/, '');
  const who = `${identities.profile.name} (@${identities.profile.handle})`;

  if (service === 'spotify') {
    const shareUrl = `${SITE}/links/spotify/`;
    const fallbackThumb = `${SITE}/og/links-spotify.png`;
    let authorName = `Spotify · ${who}`;
    let authorUrl = shareUrl;
    let title = `Spotify — @${identities.profile.handle}`;
    let thumb = fallbackThumb;

    const playback = await readJsonSafe<SpotifyPayload>(() =>
      spotify(new Request(new URL('/spotify?playback=1', request.url)), services),
    );
    const liveTrack = playback?.status?.is_playing ? playback.status.item : null;
    const liveText = trackLabel(liveTrack);

    if (liveText && liveTrack) {
      authorName = `♫ Listening now: ${liveText}`;
      authorUrl = liveTrack.external_urls?.spotify || shareUrl;
      title = `${liveText} · Spotify`;
      thumb = liveTrack.album?.images?.[0]?.url || fallbackThumb;
    } else {
      const full = await readJsonSafe<SpotifyPayload>(() =>
        spotify(new Request(new URL('/spotify', request.url)), services),
      );
      const recent = full?.recent?.items?.[0]?.track;
      const recentText = trackLabel(recent);
      if (recentText) {
        authorName = `Last played: ${recentText}`;
        authorUrl = recent?.external_urls?.spotify || shareUrl;
      }
    }

    return json(
      {
        version: '1.0',
        type: 'link',
        author_name: authorName,
        author_url: authorUrl,
        provider_name: 'hgh.dev · Spotify',
        provider_url: shareUrl,
        title,
        thumbnail_url: thumb,
        thumbnail_width: 1200,
        thumbnail_height: 630,
      },
      200,
      15,
    );
  }

  if (service === 'discord') {
    const shareUrl = `${SITE}/links/discord/`;
    const data = await readJsonSafe<DiscordPayload>(() =>
      discord(new Request(new URL('/discord', request.url)), services),
    );
    const status = data?.status || data?.discord_status || 'offline';
    const activity = (data?.activities || []).find((a) => a && a.type !== 4 && a.name);
    const dot =
      status === 'online'
        ? '● Online'
        : status === 'idle'
          ? '◐ Idle'
          : status === 'dnd'
            ? '⛔ Busy'
            : '○ Offline';
    const activityText = activity
      ? activity.type === 2 && activity.details
        ? `Listening to ${activity.details}`
        : activity.type === 0
          ? `Playing ${activity.name}`
          : activity.details || activity.name
      : '';
    const authorName = activityText ? `${dot} — ${activityText}` : `${dot} · ${who}`;

    return json(
      {
        version: '1.0',
        type: 'link',
        author_name: authorName,
        author_url: shareUrl,
        provider_name: 'hgh.dev · Discord',
        provider_url: shareUrl,
        title: `Discord — @${identities.profile.handle}`,
        thumbnail_url: `${SITE}/og/links-discord.png`,
        thumbnail_width: 1200,
        thumbnail_height: 630,
      },
      200,
      30,
    );
  }

  return json({ error: 'not found' }, 404);
}
