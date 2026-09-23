# API (`apps/api/`, `@portfolio/api`)

The TypeScript application in `src/app.ts` runs on Cloudflare Workers and Node 24.
Provider modules receive typed services for configuration, state, cache, fetch,
time, and background tasks. Keep platform globals in adapters and entrypoints.

- `src/routes.ts`: flat path -> handler table; `app.ts` only strips the prefix,
  handles methods, rewrites media, and wraps errors.
- `src/identities.ts`: the single place the API reads `links.json`; the configured
  username per provider. Never take an identity from a query parameter.
- `src/links.ts`: the batch `/links` route; calls the same provider handlers the
  single-card routes use, so caches, TTLs, and cooldowns are shared.
- `src/providers/`: provider requests and response shaping.
- `src/mail/`: the contact form. `provider.ts` is the swappable vendor interface,
  `address.ts` validates a sender without any verification service, `quota.ts`
  holds the form token and the send limits, `contact.ts` is the route.
- `src/lib/`: bounded HTTP reads, HTML parsing, schemas, cache policy, presence protocol.
  `lib/ttl.ts` holds the named cache lifetimes; `lib/snapshot.ts` holds the shared
  persisted-snapshot serving (retry cooldown, 7-day stale limit, image download, image responses cached per
  snapshot version).
- `src/media/`: cached image responses. The allowlisted image sources and asset
  URL encoding live in `packages/shared/media.ts` (`@portfolio/shared/media`),
  shared with the site.
- `src/adapters/`: Cloudflare KV/Cache API and persistent Node disk storage; WebSocket relays.
- `src/entrypoints/`: Worker handlers and Node HTTP startup/shutdown.
- `src/scheduled.ts`: Telegram, X and LinkedIn snapshot refresh and Node overlap prevention.
- `tests/`: network-free provider, storage, and HTTP regressions (`*.test.ts`),
  the Miniflare Worker smoke test (`worker.test.mjs`), and the Docker restart
  check (`container.mjs`, run only by `test:container`).
- `scripts/build.mjs`: esbuild bundle of the Node entrypoint → `dist/server.mjs`.
- `wrangler.jsonc`: Worker config template; `api:config` writes the gitignored
  `wrangler.gen.jsonc` that deploys use.
- `worker-configuration.d.ts`: Wrangler-generated bindings and runtime types.
- `tools/spotify-auth.html`: Spotify PKCE helper.

## Commands

`npm run api:serve` builds and starts Node on port 8787. `npm run api:deploy`
generates deployment configuration and deploys the Worker. `npm run api:types`
regenerates Cloudflare types after binding changes. `npm run api:check` runs
both type checks, API tests, the Node build, and a Worker dry run.
`npm run check` also lints/formats API code and builds the frontend.
Root `api:*` scripts delegate to `apps/api` (`npm run <script> -w @portfolio/api`).
`npm run test:browser` builds a same-origin frontend and checks that rendered
provider content and the Discord socket use the configured API host.
`npm run test:container` builds the Docker image and verifies cached profile/image
delivery before and after a restart with networking disabled.

No public endpoint accepts an arbitrary upstream destination. Media identifiers
encode HTTPS URLs, but each request and redirect must pass the provider host
allowlist; on hosts that also serve user uploads (`gitlab.com`,
`cdn.discordapp.com`, `pbs.twimg.com`) only the paths the cards use pass. Only raster images are served; downloads are limited to 4 MiB and
10 seconds. Telegram avatars retain their 1 MiB limit. Unknown sources display
an unavailable image instead of causing a browser request to the provider.

## Deployment and configuration

Cloudflare uses `SPOTIFY_KV`, preserving existing token and Telegram keys.
Wrangler builds TypeScript into JavaScript; type checking is a separate command.
Free Workers are supported without R2 or another paid service. Traffic, media
requests, CPU, and KV operations remain subject to Cloudflare quotas. The Cache
API is an evictable per-data-center cache, not permanent storage.

Node uses `.api-data/` by default, relative to the working directory
(`apps/api/.api-data/` under `npm run api:serve`). Docker mounts `/data` using the `api-data`
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
| `SPOTIFY_KV_ID` | Cloudflare KV namespace ID, substituted into generated `wrangler.gen.jsonc` |
| `SPOTIFY_CLIENT_ID` | Spotify PKCE client ID |
| `SPOTIFY_REFRESH_TOKEN` | Initial/fallback token; stored rotated token takes precedence |
| `STEAM_API_KEY`, `STEAM_ID` | Steam credentials and account |
| `DISCORD_ID` | Lanyard account and sole allowed socket subscription |
| `LINKEDIN_URL` | HTTPS LinkedIn profile; route returns 503 if unset |
| `MAIL_API_KEY` | Mail vendor API key; secret. Without it `/contact` returns 503 |
| `MAIL_TOKEN_SECRET` | HMAC secret for form tokens; secret. Falls back to `MAIL_API_KEY` |
| `CACHE_VERSION` | Response/media cache namespace, stable across Node restarts |
| `PORT` | Node listen port, default 8787 |
| `API_DATA_DIR` | Node persistent data directory |
| `API_CACHE_MAX_BYTES` | Node response/media cache budget, default 268435456 |
| `API_PUBLIC_ORIGIN` | Optional external origin for direct Node access behind TLS |
| `API_CLIENT_IP_HEADER` | Header a trusted proxy overwrites with the sender address (compose: `x-real-ip`); unset, Node uses the socket address |
| `VITE_API_BASE_URL` | Frontend build setting; default production Worker, Docker default `/api` |

Telegram, GitHub, GitLab and contact-form identities come from
`content/links/links.json`. There is no `TELEGRAM_USERNAME` variable,
and no `MAIL_FROM`/`MAIL_TO`/`MAIL_PROVIDER` variable.
Rebuild/redeploy after changing identities. Credentials stay in Worker secrets
or container environment variables. The Node container has no Cloudflare dependency.

Nginx forwards `/api/` to Node, including WebSocket upgrades, without replacing
API cache headers. It overwrites `X-Real-IP` with the visitor's address, which
the contact form's per-sender limit uses. Node discards client-sent
`CF-Connecting-IP`, `X-Forwarded-For` and `X-Real-IP`, and keys its disk cache on
path and query only, so the Host header cannot split it. Both runtimes accept existing unprefixed routes and `/api/`
routes. Prefixed responses use relative media URLs, so TLS termination does not
produce mixed-content URLs. Separate frontend/API hosting uses an absolute
`VITE_API_BASE_URL` and, for Node behind TLS, `API_PUBLIC_ORIGIN`.

## Routes and cache policy

All HTTP routes accept GET, HEAD and OPTIONS; `/contact` also accepts POST and
is the only route that reads a request body. HEAD sends no body. Other methods
return 405. Unknown routes return 404. Navigation links still point to providers;
images, data requests, and the live presence socket go through the API.

| Route | Cache / behavior |
| --- | --- |
| `/health` | Uncached liveness |
| `/links` | Uncached aggregate of every card; `include=`/`exclude=` filter by card key |
| `/contact` | GET mints a single-use form token; POST sends one message |
| `/spotify` | Uncached aggregate library and playback |
| `/spotify?playback=1` | Uncached playback only; preserves rate-limit response and Retry-After |
| `/steam` | 5 minutes |
| `/discord` | 60 seconds |
| `/discord/avatar` | 1 hour |
| `/discord/socket` | WebSocket relay, subscription pinned to configured Discord ID |
| `/linkedin`, `/x` | Uncached JSON from hourly persisted snapshot; stale limit 7 days |
| `/linkedin/avatar`, `/linkedin/banner`, `/x/avatar`, `/x/banner` | 1 hour, persisted snapshot image |
| `/telegram` | Uncached JSON from hourly persisted snapshot; stale limit 7 days |
| `/telegram/avatar` | 1 hour, persisted snapshot image |
| `/github`, `/github/repos`, `/github/contributions` | 1 hour, configured GitHub account only |
| `/gitlab` | 1 hour, configured GitLab account only |
| `/media/<provider>/<asset>` | 24 hours, allowlisted raster image proxy |

`/links` is what the links page requests on load. It fans out to the same handlers
the single-card routes use, so each card hits its own cache and a batch call warms
it. A card that fails carries `{ maxAge: 0, error }` and never fails the envelope;
a card that succeeds carries its route's `Cache-Control` max-age, which the client
uses to decide whether an expanded card still needs its own request.

Cloudflare Cron refreshes the Telegram, X and LinkedIn snapshots hourly. Node refreshes on startup and hourly
without blocking HTTP startup; overlapping Node refresh jobs share one promise.
Cold requests can bootstrap a snapshot. A one-minute persisted retry
cooldown reduces retries, but KV is eventually consistent and cannot guarantee
one global fetch across data centers. Failed refreshes retain previous metadata;
a failed avatar download retains the previous image. No stale playback is served.
Other media is fetched on demand; cached delivery is not an offline archive.

## Contact form

The form's configuration is content, not environment: `links.json` carries
`email.address` (the only inbox it will ever address), `email.from` (the
vendor-verified sending identity) and `email.provider` (the vendor). Only the
two credentials are variables. Rebuild/redeploy after editing those fields.

No request field names a recipient, and the message body cannot reach a header —
subjects are flattened and the visitor's address travels as Reply-To behind the
verified `email.from` identity.

A POST must carry a token from a preceding GET: HMAC-signed, single-use,
usable between 3 seconds and 30 minutes after it is minted. A hidden honeypot
field is answered as success and sends nothing. Beyond that: 2 messages per
sender per hour, 4 per day, 60 per day and 1200 per month overall (`MAIL_LIMITS`
in `src/mail/quota.ts`), all held under a 100/day, 3000/month vendor plan. The
same message from the same sender is refused for ten minutes. Bodies are capped
at 16 KiB. Validation, the token signature and a quota read run first and write
nothing, so a rejected submission costs no storage. Then, one submission at a
time, the quota is re-checked, the token is spent and the counters are
reserved; a failed send releases them, so it costs nobody their allowance. That
section is atomic on Node and within one Worker isolate. KV is eventually
consistent, so two Worker locations can still race; strict limits there would
need a Durable Object. Sender-domain lookups are cached in the evictable
response cache, not in state.

Sender validation runs without any verification service: an RFC-shaped syntax
check, a throwaway-domain list, and a DNS-over-HTTPS MX/A lookup of the domain
(cached a day). A resolver outage fails open; NXDOMAIN or a domain with no mail
records is refused.

Swapping vendor is one module: implement `MailProvider` in `src/mail/provider.ts`,
register it, and name it in `email.provider`. Nothing else in the API changes.

## Spotify re-authentication

Open `apps/api/tools/spotify-auth.html` and run PKCE with the required scopes. Update
`SPOTIFY_REFRESH_TOKEN` in deployment secrets. If a rotated token already exists
in persistent state, remove the `refresh_token` state entry as part of an explicit
credential reset; changing the fallback alone does not replace the stored token.
