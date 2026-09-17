import type { Services, StateStore } from '../src/contracts.js';
import { configuration } from '../src/config.js';

export function testServices(overrides: Partial<Services> = {}) {
  const values = new Map<string, { value: string; expires: number }>();
  const entries = new Map<string, { response: Response; expires: number }>();
  const now = overrides.now || Date.now;
  const state: StateStore = {
    async get(key) {
      const entry = values.get(key);
      return entry && (!entry.expires || entry.expires > now()) ? entry.value : null;
    },
    async put(key, value, options) {
      values.set(key, {
        value,
        expires: options?.expirationTtl ? now() + options.expirationTtl * 1000 : 0,
      });
    },
    async delete(key) {
      values.delete(key);
    },
  };
  const services: Services = {
    config: configuration({
      DISCORD_ID: '123456789',
      STEAM_ID: '123',
      STEAM_API_KEY: 'test',
    }),
    state,
    cache: {
      async match(key) {
        const entry = entries.get(key.url);
        return entry && entry.expires > now() ? entry.response.clone() : undefined;
      },
      async put(key, response) {
        entries.set(key.url, {
          response,
          expires:
            now() +
            Number(/max-age=(\d+)/.exec(response.headers.get('Cache-Control') || '')?.[1] || 0) *
              1000,
        });
      },
    },
    fetch: async () => {
      throw new Error('Unexpected network call');
    },
    now,
    background: (task) => {
      void task.catch(() => {});
    },
    ...overrides,
  };
  return services;
}
