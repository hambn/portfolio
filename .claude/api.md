# API (`api/`)

Single backend proxying platform APIs for the portfolio link cards. One file of
logic (`index.js`), runs **two ways from the same code**:

- **Cloudflare Worker** (current) — `npm run api:deploy` (`wrangler deploy --config api/wrangler.toml`).
- **Self-host on Node** — `npm run api:serve` → `http://localhost:8787`.
  `server.js` shims the three Cloudflare globals `index.js` needs (`caches.default`,
  `env.SPOTIFY_KV`, `env`) so `index.js` stays byte-identical between the two.

- **URL:** `https://api.portfolio.hgh.dev` (CF route)
- **Files:** `index.js` (worker logic — keep CF-vanilla, no npm deps), `server.js`
  (Node adapter), `wrangler.toml`, `tools/spotify-auth.html` (one-off OAuth helper).

## Rules

- `index.js` stays vanilla Worker JS — no npm packages, no build step. Node-only
  glue lives in `server.js`.
- KV (`SPOTIFY_KV`) only for persisting rotating tokens — no other KV usage.
- Use the Cache API (`caches.default`) for anything that can be stale.
- No IDs/tokens hardcoded in `index.js` — everything reads `env.*`, injected at
  deploy via `--var` (CF, from GitHub secrets) or `process.env` (self-host).
- Real-time (currently playing, online status): no cache. Profile/stats: 1h.
  Recent activity: 5m.
- Return raw upstream responses — the frontend reshapes.

## Env (all injected, none committed)

CF: passed by `api:deploy` via `wrangler --var` from shell env / GitHub Actions
secrets. Self-host: `process.env` (`SPOTIFY_CLIENT_ID=… STEAM_ID=… npm run api:serve`).

| Name | Used for |
|---|---|
| `SPOTIFY_KV_ID` | KV namespace id — CF only, `envsubst`'d into `wrangler.toml` at deploy (self-host uses an in-memory shim, ignores it) |
| `SPOTIFY_CLIENT_ID` | Spotify PKCE token exchange |
| `SPOTIFY_REFRESH_TOKEN` | Spotify auth fallback (KV takes over after first exchange) |
| `STEAM_API_KEY` | Steam Web API (get at https://steamcommunity.com/dev/apikey) |
| `STEAM_ID` | 64-bit Steam ID (https://steamid.io) |
| `DISCORD_ID` | Discord user ID (Lanyard lookup) |
| `CACHE_VERSION` | cache-bust token (auto-set per deploy) |

## Routes

| Route | Cache | Source |
|---|---|---|
| `GET /spotify` | none | aggregate: status + profile + top + recent + playlists |
| `GET /spotify/status` | none | `/me/player/currently-playing` |
| `GET /spotify/profile` | 1h | `/me` |
| `GET /spotify/favorites?type=tracks\|artists&range=short_term\|medium_term\|long_term` | 1h | `/me/top/{type}` |
| `GET /spotify/recent` | 5m | `/me/player/recently-played` |
| `GET /steam` | 5m | Steam Web API — status, level, current/favorite game, recent |
| `GET /discord` | 60s | Lanyard (`api.lanyard.rest`) — status, activities, spotify |

## Re-auth (Spotify)

When Spotify returns `invalid_grant`, mint a new refresh token:
1. Open `api/tools/spotify-auth.html`, run the PKCE flow with all required scopes
   (`user-read-currently-playing`, `user-read-private`, `user-top-read`,
   `user-read-recently-played`).
2. Update the `SPOTIFY_REFRESH_TOKEN` GitHub secret (or your shell env).
3. `npm run api:deploy`.
