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
- Use the Cache API (`caches.default`) for anything that can be stale. Cache
  keys are canonicalized to `origin + pathname` — query strings never create
  duplicate entries.
- No IDs/tokens hardcoded in `index.js` — everything reads `env.*`. Public config
  is injected at deploy via `--var` (CF, from GitHub secrets / shell env) or
  `process.env` (self-host); credentials live as **Worker secrets**
  (`wrangler secret bulk`, pushed by the CI deploy job), never in `--var`.
- Every handler is method-limited (`GET`/`HEAD`; `OPTIONS` for CORS) and every
  upstream fetch has a hard 6–10s deadline.
- Real-time (currently playing, online status): no cache. Profile/stats: 1h.
  Recent activity: 5m.
- Return raw upstream responses — the frontend reshapes.

## Env (all injected, none committed)

CF: public vars passed by `api:deploy` via `wrangler --var` from shell env /
GitHub Actions secrets; credentials uploaded as Worker secrets with
`wrangler secret bulk` (CI does both). Self-host: `process.env`
(`SPOTIFY_CLIENT_ID=… STEAM_ID=… npm run api:serve`).

| Name | Kind | Used for |
|---|---|---|
| `SPOTIFY_KV_ID` | var | KV namespace id — CF only, `envsubst`'d into `wrangler.toml` at deploy (self-host uses an in-memory shim, ignores it) |
| `SPOTIFY_CLIENT_ID` | secret | Spotify PKCE token exchange |
| `SPOTIFY_REFRESH_TOKEN` | secret | Spotify auth fallback (KV takes over after first exchange) |
| `STEAM_API_KEY` | secret | Steam Web API (get at https://steamcommunity.com/dev/apikey) |
| `STEAM_ID` | var | 64-bit Steam ID (https://steamid.io) |
| `DISCORD_ID` | var | Discord user ID (Lanyard lookup) |
| `LINKEDIN_URL` | var | Public LinkedIn profile URL to scrape (e.g. `https://linkedin.com/in/hambn`); must be https + `*.linkedin.com` or `/linkedin` returns 503 |
| `TELEGRAM_USERNAME` | var | Public Telegram username used by `/telegram` when no query or path username is supplied (defaults to `ham_bn`) |
| `CACHE_VERSION` | var | cache-bust token (auto-set per deploy) |

## Routes

| Route | Cache | Source |
|---|---|---|
| `GET /spotify` | none | aggregate: status + profile + top + recent + playlists |
| `GET /steam` | 5m | Steam Web API — status, level, current/favorite game, recent |
| `GET /discord` | 60s | Lanyard (`api.lanyard.rest`) — status, activities, spotify |
| `GET /discord/avatar` | 1h | proxied Discord avatar image |
| `GET /linkedin` | 1h | scraped OG meta tags from `LINKEDIN_URL` — name, headline, avatar, url (503 if unset) |
| `GET /telegram[?username=<username>]` | 1h | scraped public `t.me` HTML — name, username, photo, description, contact; defaults to `TELEGRAM_USERNAME` |
| `GET /telegram/avatar[?username=<username>]` | 1h | Telegram profile photo proxied and cached by the Worker/CDN |
| `GET /health` | none | `{ ok: true }` liveness check |

Anything else 404s; non-GET/HEAD 405s.

## Re-auth (Spotify)

When Spotify returns `invalid_grant`, mint a new refresh token:
1. Open `api/tools/spotify-auth.html`, run the PKCE flow with all required scopes
   (`user-read-currently-playing`, `user-read-private`, `user-top-read`,
   `user-read-recently-played`).
2. Update the `SPOTIFY_REFRESH_TOKEN` GitHub secret (or your shell env).
3. `npm run api:deploy`.
