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
// A snapshot image addressed by its own fingerprint: the URL changes when the
// picture does, so a browser may hold it this long without revalidating.
export const IMAGE_TTL = 30 * DAY;

// A persisted profile snapshot older than this stops being served at all.
export const SNAPSHOT_STALE_MS = 7 * DAY * 1000;
// How long a failed snapshot refresh blocks the next attempt.
export const REFRESH_COOLDOWN_TTL = MINUTE;
// The projects envelope is cheap to rebuild from state, so it is cached only
// briefly: a refreshed snapshot reaches visitors within this window.
export const PROJECTS_RESPONSE_TTL = 5 * MINUTE;
// The scheduler refreshes the projects snapshot every hour. Counting it as
// fresh a little longer than that means a visitor only ever triggers a refresh
// when a scheduled one was missed.
export const PROJECTS_TTL = HOUR + 10 * MINUTE;
// A snapshot missing a host (it failed and there was nothing earlier to keep)
// is retried this soon instead of waiting for the next scheduled run.
export const PROJECTS_RETRY_TTL = 5 * MINUTE;
