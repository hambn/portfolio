# API (`api/`)

The TypeScript application in `src/app.ts` runs on Cloudflare Workers and Node 24.
Provider modules receive typed services for configuration, state, cache, fetch,
time, and background tasks. Keep platform globals in adapters and entrypoints.

- `src/providers/`: provider requests and response shaping.
- `src/lib/`: bounded HTTP reads, HTML parsing, schemas, cache policy, presence protocol.
- `src/media/`: allowlisted image sources, asset URLs, and cached image responses.
- `src/adapters/`: Cloudflare KV/Cache API and persistent Node disk storage; WebSocket relays.
- `src/entrypoints/`: Worker handlers and Node HTTP startup/shutdown.
- `src/scheduled.ts`: Telegram refresh and Node overlap prevention.
- `tests/`: network-free provider, storage, and HTTP regressions.
- `worker-configuration.d.ts`: Wrangler-generated bindings and runtime types.
- `tools/spotify-auth.html`: Spotify PKCE helper.

## Commands

`npm run api:serve` builds and starts Node on port 8787. `npm run api:deploy`
generates deployment configuration and deploys the Worker. `npm run api:types`
regenerates Cloudflare types after binding changes. `npm run api:check` runs
both type checks, API tests, the Node build, and a Worker dry run.
`npm run check` also lints/formats API code and builds the frontend.
`npm run test:browser` builds a same-origin frontend and checks that rendered
provider content and the Discord socket use the configured API host.
`npm run test:container` builds the Docker image and verifies cached profile/image
delivery before and after a restart with networking disabled.

No public endpoint accepts an arbitrary upstream destination. Media identifiers
encode HTTPS URLs, but each request and redirect must pass the provider host
allowlist. Only raster images are served; downloads are limited to 4 MiB and
10 seconds. Telegram avatars retain their 1 MiB limit. Unknown sources display
an unavailable image instead of causing a browser request to the provider.

## Deployment and configuration

Cloudflare uses `SPOTIFY_KV`, preserving existing token and Telegram keys.
Wrangler builds TypeScript into JavaScript; type checking is a separate command.
Free Workers are supported without R2 or another paid service. Traffic, media
requests, CPU, and KV operations remain subject to Cloudflare quotas. The Cache
API is an evictable per-data-center cache, not permanent storage.

Node uses `.api-data/` by default. Docker mounts `/data` using the `api-data`
named volume. State and cache occupy separate directories. State includes
rotating Spotify tokens and profile snapshots; eviction never removes tokens.
Cache writes are atomic and serialized, and oldest entries are pruned to the
configured byte budget. Expired entries are never served. Restarting with the
same data directory retains valid cache entries and state.

Run one API process per data directory. Multiple replicas need shared storage
and scheduling coordination. Back up the state directory as secret data. Do not
remove the Docker volume unless you intend to discard it.

| Variable | Purpose |
| --- | --- |
| `SPOTIFY_KV_ID` | Cloudflare KV namespace ID, substituted into generated TOML |
| `SPOTIFY_CLIENT_ID` | Spotify PKCE client ID |
| `SPOTIFY_REFRESH_TOKEN` | Initial/fallback token; stored rotated token takes precedence |
| `STEAM_API_KEY`, `STEAM_ID` | Steam credentials and account |
| `DISCORD_ID` | Lanyard account and sole allowed socket subscription |
| `LINKEDIN_URL` | HTTPS LinkedIn profile; route returns 503 if unset |
| `CACHE_VERSION` | Response/media cache namespace, stable across Node restarts |
| `PORT` | Node listen port, default 8787 |
| `API_DATA_DIR` | Node persistent data directory |
| `API_CACHE_MAX_BYTES` | Node response/media cache budget, default 268435456 |
| `API_PUBLIC_ORIGIN` | Optional external origin for direct Node access behind TLS |
| `VITE_API_BASE_URL` | Frontend build setting; default production Worker, Docker default `/api` |

Telegram, GitHub and GitLab identities come from
`public/contents/links/links.json`. There is no `TELEGRAM_USERNAME` variable.
Rebuild/redeploy after changing identities. Credentials stay in Worker secrets
or container environment variables. The Node container has no Cloudflare dependency.

Nginx forwards `/api/` to Node, including WebSocket upgrades, without replacing
API cache headers. Both runtimes accept existing unprefixed routes and `/api/`
routes. Prefixed responses use relative media URLs, so TLS termination does not
produce mixed-content URLs. Separate frontend/API hosting uses an absolute
`VITE_API_BASE_URL` and, for Node behind TLS, `API_PUBLIC_ORIGIN`.

## Routes and cache policy

All HTTP routes accept GET, HEAD and OPTIONS. HEAD sends no body. Other methods
return 405. Unknown routes return 404. Navigation links still point to providers;
images, data requests, and the live presence socket go through the API.

| Route | Cache / behavior |
| --- | --- |
| `/health` | Uncached liveness |
| `/spotify` | Uncached aggregate library and playback |
| `/spotify?playback=1` | Uncached playback only; preserves rate-limit response and Retry-After |
| `/steam` | 5 minutes |
| `/discord` | 60 seconds |
| `/discord/avatar` | 1 hour |
| `/discord/socket` | WebSocket relay, subscription pinned to configured Discord ID |
| `/linkedin` | 1 hour; last good snapshot for up to 7 days on upstream failure |
| `/telegram` | Uncached JSON from hourly persisted snapshot; stale limit 7 days |
| `/telegram/avatar` | 1 hour, persisted snapshot image |
| `/github`, `/github/repos`, `/github/contributions` | 1 hour, configured GitHub account only |
| `/gitlab` | 1 hour, configured GitLab account only |
| `/media/<provider>/<asset>` | 24 hours, allowlisted raster image proxy |

Cloudflare Cron refreshes Telegram hourly. Node refreshes on startup and hourly
without blocking HTTP startup; overlapping Node refresh jobs share one promise.
Cold Telegram requests can bootstrap the snapshot. A one-minute persisted retry
cooldown reduces retries, but KV is eventually consistent and cannot guarantee
one global fetch across data centers. Failed refreshes retain previous metadata;
a failed avatar download retains the previous image. No stale playback is served.
Other media is fetched on demand; cached delivery is not an offline archive.

## Spotify re-authentication

Open `api/tools/spotify-auth.html` and run PKCE with the required scopes. Update
`SPOTIFY_REFRESH_TOKEN` in deployment secrets. If a rotated token already exists
in persistent state, remove the `refresh_token` state entry as part of an explicit
credential reset; changing the fallback alone does not replace the stored token.
