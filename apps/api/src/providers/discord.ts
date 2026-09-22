import type { Services } from '../contracts.js';
import { json, fetchWithTimeout, readJSON } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { DISCORD_TTL, PROFILE_TTL } from '../lib/ttl.js';
import { lanyardData } from '../lib/schemas.js';
import { fetchMedia } from '../media/handler.js';

async function lanyard(services: Services) {
  const response = await fetchWithTimeout(
    services,
    `https://api.lanyard.rest/v1/users/${services.config.DISCORD_ID}`,
  );
  return readJSON(response, lanyardData);
}

export async function handle(request: Request, services: Services) {
  const { pathname } = new URL(request.url);
  if (!/^\d+$/.test(services.config.DISCORD_ID))
    return json({ error: 'discord_not_configured' }, 503);
  if (pathname === '/discord/avatar') {
    // proxied through our own domain + edge cache, so the browser never hits discordapp.com
    return withCache(services, request, async () => {
      const { success, data } = await lanyard(services);
      if (!success || !data) return new Response(null, { status: 502 });

      const user = data.discord_user;
      const cdnUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.id) >> 22n) % 6n}.png`;

      const image = await fetchMedia(services, 'discord', cdnUrl);
      if (image.ok) image.headers.set('Cache-Control', `public, max-age=${PROFILE_TTL}`);
      return image;
    });
  }

  return withCache(services, request, async () => {
    const { success, data } = await lanyard(services);

    if (!success || !data) return json({ error: 'lanyard_failed' }, 200, DISCORD_TTL);

    const user = data.discord_user;

    return json(
      {
        username: user.username,
        displayName: user.global_name ?? user.username,
        id: user.id,
        avatar: '/discord/avatar',
        status: data.discord_status,
        activities: data.activities,
      },
      200,
      DISCORD_TTL,
    );
  });
}
