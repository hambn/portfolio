import { presence } from '../adapters/worker-presence.js';
import { handleRequest } from '../app.js';
import { cloudflareServices, type WorkerEnv } from '../adapters/cloudflare.js';
import { refresh } from '../scheduled.js';

export default {
  fetch(request, env, ctx) {
    if (
      ['/discord/socket', '/api/discord/socket'].includes(new URL(request.url).pathname) &&
      request.headers.get('Upgrade')?.toLowerCase() === 'websocket'
    )
      return presence(env.DISCORD_ID || '');
    return handleRequest(request, cloudflareServices(env, ctx));
  },
  async scheduled(_event, env, ctx) {
    await refresh(cloudflareServices(env, ctx));
  },
} satisfies ExportedHandler<WorkerEnv>;
