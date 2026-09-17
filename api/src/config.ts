import type { Config } from './contracts.js';

export function configuration(values: Partial<Record<keyof Config, string>>): Config {
  return {
    CACHE_VERSION: values.CACHE_VERSION || '1',
    SPOTIFY_CLIENT_ID: values.SPOTIFY_CLIENT_ID || '',
    SPOTIFY_REFRESH_TOKEN: values.SPOTIFY_REFRESH_TOKEN || '',
    STEAM_API_KEY: values.STEAM_API_KEY || '',
    STEAM_ID: values.STEAM_ID || '',
    DISCORD_ID: values.DISCORD_ID || '',
    LINKEDIN_URL: values.LINKEDIN_URL || '',
  };
}
