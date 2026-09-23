# portfolio

Personal portfolio for **hamed ghasempour** (@hambn). Static React site built
with Vite, prerendered for SEO, deployed to GitHub Pages at https://hgh.dev.

All content is data — edit `content/`, never the code.

An npm-workspaces monorepo: the site is `apps/web`, the API is `apps/api`, code
they share is `packages/shared`. Run every command from the repo root. Layout and
conventions: [`.agents/structure.md`](.agents/structure.md).

## develop

```bash
npm ci
npm run dev        # http://localhost:5173/
npm run build      # → apps/web/dist/  (prerender + 404.html + .nojekyll)
npm run preview    # serve the production build locally
```

## Code checks

Use Node.js 24 (see `.nvmrc`) and `npm ci` to install the locked dependencies.

```bash
npm run format        # format frontend, API, styles, and build scripts
npm run lint          # check JavaScript, TypeScript, JSX, and React hooks
npm run check         # lint, type-check/test/build the API, web unit tests, verify formatting, build the site
npm run test:browser  # Playwright regressions (npx playwright install chromium once)
```

Prettier uses two-space indentation, single quotes, and a 100-column print width.
ESLint checks browser code and Node build scripts with separate globals. The
React rules preserve the classic JSX transform and explicit React imports.
ESLint stays on version 9 for compatibility with eslint-plugin-react's peer
dependency range.

These checks cover every workspace (`apps/web`, `apps/api`, `packages/shared`) and
root JavaScript configuration. Editable content stays outside the formatting scope.
Pull requests run `npm run check` and the Playwright suite
(`.github/workflows/ci.yml`); the Pages build runs the checks before deployment.

## deploy

Pushing to `main` builds and deploys automatically
(`.github/workflows/deploy.yml`). One-time: set repo **Settings → Pages →
Source** to **GitHub Actions**.

Custom domain `hgh.dev` is set via `apps/web/public/CNAME` + DNS:

- apex `A` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
- `www` `CNAME` → `hambn.github.io`

### deploy target (env)

Route and origin are env-driven; defaults target `hgh.dev` at root. Override to
host elsewhere (e.g. a github.io project page):

| var         | default           | purpose                                           |
| ----------- | ----------------- | ------------------------------------------------- |
| `BASE_PATH` | `/`               | deploy route (asset base + link prefix)           |
| `SITE_URL`  | `https://hgh.dev` | canonical origin (sitemap, robots, OG, canonical) |

```bash
# github.io project page under /portfolio/
BASE_PATH=/portfolio/ SITE_URL=https://hambn.github.io/portfolio npm run build
```

## API (link cards)

The TypeScript backend in `apps/api/src/` serves provider data and cached images for
the portfolio. Shared provider code runs through Cloudflare and Node adapters.
The browser loads provider content through the API host, including GitHub/GitLab
profiles and Discord live presence. External navigation links remain external.

### Cloudflare Worker (current — free)

Served at `https://api.portfolio.hgh.dev`. Nothing sensitive is committed —
`npm run api:deploy` passes public config (`STEAM_ID`, `DISCORD_ID`,
`LINKEDIN_URL`, `CACHE_VERSION`) via `wrangler --var`, while credentials
(`SPOTIFY_CLIENT_ID`, `SPOTIFY_REFRESH_TOKEN`, `STEAM_API_KEY`) are uploaded
once as **Worker secrets** with `wrangler secret bulk` (the CI job does this on
every deploy).

**KV namespace** (`SPOTIFY_KV`, stores rotating tokens and profile snapshots) — create once,
its id goes in the `SPOTIFY_KV_ID` secret/env (injected into `apps/api/wrangler.jsonc`
at deploy via `envsubst`, never committed):

```bash
wrangler kv namespace create SPOTIFY_KV   # → copy id into SPOTIFY_KV_ID
```

#### CI deploy (GitHub Actions)

`deploy.yml` runs `npm run api:deploy` on every push to `main`. Add these under
**Settings → Secrets and variables → Actions → New repository secret**:

| secret                  | what / where                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | dash.cloudflare.com → My Profile → API Tokens → _Edit Cloudflare Workers_ template  |
| `CLOUDFLARE_ACCOUNT_ID` | Workers & Pages dashboard → right sidebar                                           |
| `SPOTIFY_KV_ID`         | `wrangler kv namespace create SPOTIFY_KV` → the printed id                          |
| `SPOTIFY_CLIENT_ID`     | developer.spotify.com/dashboard                                                     |
| `SPOTIFY_REFRESH_TOKEN` | from `apps/api/tools/spotify-auth.html` (PKCE flow)                                 |
| `STEAM_API_KEY`         | steamcommunity.com/dev/apikey                                                       |
| `STEAM_ID`              | your 64-bit Steam ID (https://steamid.io)                                           |
| `DISCORD_ID`            | your Discord user ID (right-click → Copy User ID)                                   |
| `LINKEDIN_URL`          | optional public profile URL; overrides `links.json`                                 |

Pages deploy needs no secrets — GitHub's `GITHUB_TOKEN` is automatic. `STEAM_ID`
and `DISCORD_ID` are public on your profiles; kept as secrets only so nothing
identifying sits in git.

#### Manual deploy

`SPOTIFY_KV_ID` and the public vars are read from your shell env. Credentials go
in once, as Worker secrets:

```bash
export SPOTIFY_KV_ID=… STEAM_ID=… DISCORD_ID=… LINKEDIN_URL=…
npm run api:config   # writes apps/api/wrangler.gen.jsonc from wrangler.jsonc
echo '{"SPOTIFY_CLIENT_ID":"…","SPOTIFY_REFRESH_TOKEN":"…","STEAM_API_KEY":"…"}' \
  | npx wrangler secret bulk --config apps/api/wrangler.gen.jsonc
npm run api:deploy
```

| Route                                             | Cache           | Data                                                         |
| ------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| `GET /spotify`                                    | none            | aggregate: now-playing + profile + top + recent + playlists  |
| `GET /spotify?playback=1`                         | no-store        | current playback only; forwards Spotify rate limits          |
| `GET /steam`                                      | 5m              | status, level, current/favorite game, recent activity        |
| `GET /discord`                                    | 60s             | presence + activities + Spotify (via Lanyard)                |
| `GET /discord/avatar`                             | 1h              | proxied Discord avatar image                                 |
| `GET /linkedin[?username=<username>]`             | hourly snapshot | public profile configured in `links.json`                    |
| `GET /linkedin/avatar` and `GET /linkedin/banner` | 1h              | image bytes stored with the profile snapshot                 |
| `GET /telegram[?username=<username>]`             | 1h              | scheduled snapshot of the profile configured in `links.json` |
| `GET /telegram/avatar[?username=<username>]`      | 1h              | photo bytes stored with the hourly profile snapshot          |
| `GET /health`                                     | none            | `{ ok: true }` liveness check                                |

LinkedIn runs entirely inside the API. Node starts a refresh on startup and every
hour; Workers use the hourly scheduled handler. Profile data and images are saved
together in `/data` for the container or KV for Workers. Failed refreshes retain
the last successful snapshot for up to seven days.

Set `LINKEDIN_URL` to choose a public profile at runtime without rebuilding the
container. If omitted, the API uses `linkedin.handle` from
`content/links/links.json`. Invalid URLs are rejected. Requests can only
read the configured profile, so the API does not become an arbitrary URL proxy.
No GitHub Actions job or external snapshot upload is needed.

The guest request headers work in the tested Node environment, including image
downloads. LinkedIn still returned HTTP 999 from Cloudflare's network during
validation. The API reports that block and retains cached data; it cannot
guarantee access from every hosting network or read private profiles without
authorized account access.

The Spotify card checks playback every 3 seconds while the page is visible and
refreshes immediately on return. The timeline uses elapsed time between samples;
profile and library data refresh every minute and after track/context changes.
Deploy the API update with the frontend to enable playback-only responses. Older
API deployments still work, but return the slower aggregate response.
Run `npm run test:spotify` for the playback clock and API regression checks.

Telegram reads `telegram.url` in `content/links/links.json`, with
`username` or `handle` as fallbacks. Redeploy the API and frontend after changing
this file. Only that configured profile is served; the optional `username` query
must match it.

The Worker cron (`0 * * * *`) fetches the public Telegram HTML and photo once per
hour, including hours with no visits. A single snapshot in the existing
`SPOTIFY_KV` namespace stores the name, username, description, public metadata,
photo bytes, and update time. Requests read the snapshot. If a new deployment
has no snapshot yet, a request can bootstrap it. A persisted one-minute cooldown
reduces retries; KV eventual consistency cannot guarantee one global refresh.
Failed refreshes keep the previous data. KV propagation can briefly delay
updates.

The Node adapter refreshes at startup and hourly, with overlapping scheduled jobs
coalesced. Tokens, snapshots, and cached images persist on disk across restarts.
Both runtimes keep the previous image after a temporary download failure and
serve profile snapshots for up to seven days after a failed refresh. Run `npm run test:telegram` for scheduler, cache, parsing,
and failure regression checks.

The card's wallpaper asset comes from
[Telegram's public profile background](https://telegram.org/img/tgme/pattern.svg?1).

Full reference + Spotify re-auth flow: [`.agents/api.md`](.agents/api.md).

### Self-host on Node

`npm run api:serve` compiles the TypeScript entrypoint and runs it on Node 24.
State and cache persist in `apps/api/.api-data/`, or the directory set by `API_DATA_DIR`.
The response/media cache defaults to 256 MiB; tokens are stored separately.
Use one API process per data directory.

```bash
SPOTIFY_CLIENT_ID=… STEAM_API_KEY=… DISCORD_ID=… STEAM_ID=… SPOTIFY_REFRESH_TOKEN=… npm run api:serve   # → http://localhost:8787
```

Environment variables:

| var                     | type   | required                                              |
| ----------------------- | ------ | ----------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`     | secret | yes                                                   |
| `SPOTIFY_REFRESH_TOKEN` | config | yes (fallback token)                                  |
| `STEAM_API_KEY`         | secret | yes                                                   |
| `STEAM_ID`              | config | yes                                                   |
| `DISCORD_ID`            | config | yes                                                   |
| `LINKEDIN_URL`          | config | optional public profile URL; defaults to `links.json` |
| `CACHE_VERSION`         | config | no (Node default: `1`, stable across restarts)        |
| `API_DATA_DIR`          | config | no (default: `.api-data`, relative to the cwd)        |
| `API_CACHE_MAX_BYTES`   | config | no (default: `268435456`)                             |
| `API_PUBLIC_ORIGIN`     | config | external origin for direct Node access behind TLS     |
| `API_CLIENT_IP_HEADER`  | config | no (proxy header with the sender address; compose: `x-real-ip`) |

## self-host (Docker)

`deploy/compose.yaml` runs the **whole stack** — static site (nginx) + API (Node) — from
the repo root:

```bash
docker compose -f deploy/compose.yaml up -d --build
# web → http://localhost:8080   api → http://localhost:8787
```

A private homelab host only needs outbound internet access to the providers.
It does not need GitHub Actions, Cloudflare credentials, a public domain, or inbound
internet access. On your LAN, open `http://<homelab-ip>:8080`; the site uses its own
`/api/` route. The API is also available directly at `http://<homelab-ip>:8787`.
Telegram, X, and LinkedIn refresh on API startup and every hour. Other providers
refresh through their existing request caches and polling intervals.

To run only the API:

```bash
docker build -f apps/api/Dockerfile -t portfolio-api .
docker run -d --name portfolio-api --restart unless-stopped \
  -p 8787:8787 -v portfolio-api-data:/data \
  -e LINKEDIN_URL=https://www.linkedin.com/in/hambn/ \
  portfolio-api
```

Pass the provider credentials below when enabling Spotify and Steam. If a reverse
proxy changes the external scheme or host, set `API_PUBLIC_ORIGIN` to your API's
address, for example `https://api.home.example`. A private HTTP address works too.

API environment variables (from host env or `.env` file beside compose):

```bash
# deploy/.env
SPOTIFY_CLIENT_ID=…
SPOTIFY_REFRESH_TOKEN=…
STEAM_API_KEY=…
STEAM_ID=…
DISCORD_ID=…
```

Override the site's deploy target via env (compose passes them as build args):

```bash
BASE_PATH=/ SITE_URL=https://my.domain \
  docker compose -f deploy/compose.yaml up -d --build
```

Nginx forwards `/api/` and the Discord WebSocket to the API container. The frontend
Docker build defaults to `VITE_API_BASE_URL=/api`; standalone frontend builds default
to the production Worker. Override `VITE_API_BASE_URL` at build time for another API.
For local development, run `npm run api:serve` and `VITE_API_BASE_URL=/api npm run dev`.

The named `api-data` volume stores tokens, snapshots and cached images. Keep it
across container replacements. Back up its state directory as secret data. Cache
eviction cannot remove tokens. Multi-replica deployment needs shared storage and
scheduler coordination.

Put TLS in front of Nginx, which serves plain port 80. Neither runtime redirects
media downloads to provider hosts. Images are cached on demand, with a 4 MiB limit;
unavailable or unsupported images use the existing UI fallback.

Run `npm run api:check` for both runtime builds and network-free API tests.
Run `npm run test:browser` for the browser content-origin regression. Cloudflare
Free remains subject to request, CPU and KV quotas; media traffic counts too.

## editing content

All content lives in `content/` — no code changes needed.

| What                         | File                        |
| ---------------------------- | --------------------------- |
| name, handle, bio, avatar    | `content/home/profile.json` |
| work / education / skills    | `content/home/resume.json`  |
| social links + API endpoints | `content/links/links.json`  |
| blog posts                   | `content/blogs/**/*.md`     |

Identity meta (`author`, `og:image`, `twitter:creator`, JSON-LD) is injected at
build from `profile.json` + `links.json` — `apps/web/index.html` holds only fallbacks.

### adding a blog post

Drop a Markdown file anywhere under `content/blogs/` (sub-folders are
fine). Start it with frontmatter:

```markdown
---
title: Building a NixOS Homelab
date: 2026-05-12
description: One-line summary shown in the list and meta tags.
tags: [nixos, homelab, devops]
---

your post body in GitHub-flavored markdown…
```

- Index is generated automatically at build/dev — **no manifest to update**.
- Route is `/blog/<filename-without-.md>`, so keep filenames unique.
- **Hide a draft** by omitting `title` — files without a title are skipped.

## structure

The repo layout, workspace boundaries and code conventions are documented in
[`.agents/structure.md`](.agents/structure.md); the API has its own guide in
[`.agents/api.md`](.agents/api.md).
