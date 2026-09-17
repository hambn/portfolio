export interface StateStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ResponseCache {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
}

export interface Config {
  CACHE_VERSION: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_REFRESH_TOKEN: string;
  STEAM_API_KEY: string;
  STEAM_ID: string;
  DISCORD_ID: string;
  LINKEDIN_URL: string;
}

export interface Services {
  config: Config;
  state: StateStore;
  cache: ResponseCache;
  fetch: typeof fetch;
  now: () => number;
  background: (task: Promise<unknown>) => void;
}
