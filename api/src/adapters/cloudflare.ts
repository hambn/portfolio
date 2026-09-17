import { configuration } from '../config.js';
import type { Config, Services } from '../contracts.js';

// Wrangler generates Env. Secrets are optional deployment inputs, not new bindings.
export type WorkerEnv = Env & Partial<Omit<Config, 'CACHE_VERSION'>>;
export function cloudflareServices(env: WorkerEnv, ctx: ExecutionContext): Services {
  return {
    config: configuration(env),
    state: env.SPOTIFY_KV,
    cache: caches.default,
    fetch: (...args) => fetch(...args),
    now: Date.now,
    background: (task) => ctx.waitUntil(task),
  };
}
