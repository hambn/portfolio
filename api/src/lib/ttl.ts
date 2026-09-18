// Response cache lifetimes, in seconds. Kept together so the route table in
// routes.ts and the `maxAge` a batch response reports per card cannot drift
// from the Cache-Control a single-card route actually sends.
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86400;

export const DISCORD_TTL = MINUTE;
export const STEAM_TTL = 5 * MINUTE;
export const PROFILE_TTL = HOUR;
export const MEDIA_TTL = DAY;

// A persisted profile snapshot older than this stops being served at all.
export const SNAPSHOT_STALE_MS = 7 * DAY * 1000;
// How long a failed snapshot refresh blocks the next attempt.
export const REFRESH_COOLDOWN_TTL = MINUTE;
