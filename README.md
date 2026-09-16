# portfolio

Personal portfolio for **hamed ghasempour** (@hambn). Static React site built
with Vite, prerendered for SEO, deployed to GitHub Pages at https://hgh.dev.

All content is data — edit `public/contents/`, never the code.

## develop

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # → dist/  (prerender + 404.html + .nojekyll)
npm run preview    # serve the production build locally
```

## Code checks

Use Node.js 22 or newer and `npm ci` to install the locked dependencies.

```bash
npm run format        # format frontend code, styles, and build scripts
npm run lint          # check JavaScript, JSX, and React hook dependencies
npm run check         # lint, verify formatting, and build the site
```

Prettier uses two-space indentation, single quotes, and a 100-column print width.
ESLint checks browser code and Node build scripts with separate globals. The
React rules preserve the classic JSX transform and explicit React imports.
ESLint stays on version 9 for compatibility with eslint-plugin-react's peer
dependency range.

These checks cover `src/`, `scripts/`, and root JavaScript configuration.
API code and editable content are outside this formatting and linting scope.
Pull requests run the checks; the Pages build runs them before deployment.

## deploy

Pushing to `main` builds and deploys automatically
(`.github/workflows/deploy.yml`). One-time: set repo **Settings → Pages →
Source** to **GitHub Actions**.

Custom domain `hgh.dev` is set via `public/CNAME` + DNS:

- apex `A` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153`
- `www` `CNAME` → `hambn.github.io`

### deploy target (env)

Route and origin are env-driven; defaults target `hgh.dev` at root. Override to
host elsewhere (e.g. a github.io project page):

| var | default | purpose |
|-----|---------|---------|
| `BASE_PATH` | `/` | deploy route (asset base + link prefix) |
| `SITE_URL` | `https://hgh.dev` | canonical origin (sitemap, robots, OG, canonical) |

```bash
# github.io project page under /portfolio/
BASE_PATH=/portfolio/ SITE_URL=https://hambn.github.io/portfolio npm run build
```

## API (link cards)

The Spotify / Discord / Steam / Telegram link cards read live data from a small backend in
`api/` (one file, `index.js`). The **same code** runs two ways:

### Cloudflare Worker (current — free)

Served at `https://api.portfolio.hgh.dev`. Nothing sensitive is committed —
`npm run api:deploy` passes public config (`STEAM_ID`, `DISCORD_ID`,
`LINKEDIN_URL`, `CACHE_VERSION`) via `wrangler --var`, while credentials
(`SPOTIFY_CLIENT_ID`, `SPOTIFY_REFRESH_TOKEN`, `STEAM_API_KEY`) are uploaded
once as **Worker secrets** with `wrangler secret bulk` (the CI job does this on
every deploy).

**KV namespace** (`SPOTIFY_KV`, stores rotating Spotify tokens) — create once,
its id goes in the `SPOTIFY_KV_ID` secret/env (injected into `wrangler.toml` at
deploy via `envsubst`, never committed):

```bash
wrangler kv namespace create SPOTIFY_KV   # → copy id into SPOTIFY_KV_ID
```

#### CI deploy (GitHub Actions)

`deploy.yml` runs `npm run api:deploy` on every push to `main`. Add these under
**Settings → Secrets and variables → Actions → New repository secret**:

| secret | what / where |
|--------|--------------|
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Workers & Pages dashboard → right sidebar |
| `SPOTIFY_KV_ID` | `wrangler kv namespace create SPOTIFY_KV` → the printed id |
| `SPOTIFY_CLIENT_ID` | developer.spotify.com/dashboard |
| `SPOTIFY_REFRESH_TOKEN` | from `api/tools/spotify-auth.html` (PKCE flow) |
| `STEAM_API_KEY` | steamcommunity.com/dev/apikey |
| `STEAM_ID` | your 64-bit Steam ID (https://steamid.io) |
| `DISCORD_ID` | your Discord user ID (right-click → Copy User ID) |
| `LINKEDIN_URL` | your public LinkedIn profile URL (e.g. `https://linkedin.com/in/hambn`) |

Pages deploy needs no secrets — GitHub's `GITHUB_TOKEN` is automatic. `STEAM_ID`
and `DISCORD_ID` are public on your profiles; kept as secrets only so nothing
identifying sits in git.

#### Manual deploy

`SPOTIFY_KV_ID` and the public vars are read from your shell env. Credentials go
in once, as Worker secrets:

```bash
export SPOTIFY_KV_ID=… STEAM_ID=… DISCORD_ID=… LINKEDIN_URL=…
npm run api:config   # writes api/wrangler.gen.toml from wrangler.toml
echo '{"SPOTIFY_CLIENT_ID":"…","SPOTIFY_REFRESH_TOKEN":"…","STEAM_API_KEY":"…"}' \
  | npx wrangler secret bulk --config api/wrangler.gen.toml
npm run api:deploy
```

| Route | Cache | Data |
|-------|-------|------|
| `GET /spotify` | none | aggregate: now-playing + profile + top + recent + playlists |
| `GET /spotify?playback=1` | no-store | current playback only; forwards Spotify rate limits |
| `GET /steam` | 5m | status, level, current/favorite game, recent activity |
| `GET /discord` | 60s | presence + activities + Spotify (via Lanyard) |
| `GET /discord/avatar` | 1h | proxied Discord avatar image |
| `GET /linkedin` | 1h | profile OG tags scraped from `LINKEDIN_URL` |
| `GET /telegram[?username=<username>]` | 1h | scheduled snapshot of the profile configured in `links.json` |
| `GET /telegram/avatar[?username=<username>]` | 1h | photo bytes stored with the hourly profile snapshot |
| `GET /health` | none | `{ ok: true }` liveness check |

The Spotify card checks playback every 3 seconds while the page is visible and
refreshes immediately on return. The timeline uses elapsed time between samples;
profile and library data refresh every minute and after track/context changes.
Deploy the API update with the frontend to enable playback-only responses. Older
API deployments still work, but return the slower aggregate response.
Run `npm run test:spotify` for the playback clock and API regression checks.

Telegram reads `telegram.url` in `public/contents/links/links.json`, with
`username` or `handle` as fallbacks. Redeploy the API and frontend after changing
this file. Only that configured profile is served; the optional `username` query
must match it.

The Worker cron (`0 * * * *`) fetches the public Telegram HTML and photo once per
hour, including hours with no visits. A single snapshot in the existing
`SPOTIFY_KV` namespace stores the name, username, description, public metadata,
photo bytes, and update time. Requests only read the snapshot. Failed refreshes
keep the previous data. On a first Worker deployment, the profile becomes
available after the first hourly trigger; until then, the API returns 503 and
the card still links to Telegram. KV propagation can briefly delay updates.

The Node adapter refreshes at startup and every hour while running. Its cache is
in memory, so a restart performs an extra initial fetch. Run one API instance if
you want 24 scheduled profile fetches per day. Each refresh also downloads the
photo when available. Run `npm run test:telegram` for scheduler, cache, parsing,
and failure regression checks.

The card's wallpaper asset comes from
[Telegram's public profile background](https://telegram.org/img/tgme/pattern.svg?1).


Full reference + Spotify re-auth flow: [`.claude/api.md`](.claude/api.md).

### Self-host on Node

`api/server.js` shims the Cloudflare globals (`caches`, KV, `env`) so the
unchanged `index.js` runs on plain Node — no dependencies:

```bash
SPOTIFY_CLIENT_ID=… STEAM_API_KEY=… DISCORD_ID=… STEAM_ID=… SPOTIFY_REFRESH_TOKEN=… npm run api:serve   # → http://localhost:8787
```

Environment variables:

| var | type | required |
|-----|------|----------|
| `SPOTIFY_CLIENT_ID` | secret | yes |
| `SPOTIFY_REFRESH_TOKEN` | config | yes (fallback token) |
| `STEAM_API_KEY` | secret | yes |
| `STEAM_ID` | config | yes |
| `DISCORD_ID` | config | yes |
| `LINKEDIN_URL` | config | no (`/linkedin` returns 503 without it) |
| `TELEGRAM_USERNAME` | config | no (defaults to `ham_bn`) |
| `CACHE_VERSION` | config | no (default: `0`) |

## self-host (Docker)

`deployment/` runs the **whole stack** — static site (nginx) + API (Node) — from
the repo root:

```bash
docker compose -f deployment/docker-compose.yml up -d --build
# web → http://localhost:8080   api → http://localhost:8787
```

API environment variables (from host env or `.env` file beside compose):

```bash
# deployment/.env
SPOTIFY_CLIENT_ID=…
SPOTIFY_REFRESH_TOKEN=…
STEAM_API_KEY=…
STEAM_ID=…
DISCORD_ID=…
```

Override the site's deploy target via env (compose passes them as build args):

```bash
BASE_PATH=/ SITE_URL=https://my.domain \
  docker compose -f deployment/docker-compose.yml up -d --build
```

Put TLS (Caddy / Traefik / Cloudflare) in front — nginx serves plain `:80`.

## editing content

All content lives in `public/contents/` — no code changes needed.

| What | File |
|------|------|
| name, handle, bio, avatar | `public/contents/home/profile.json` |
| work / education / skills | `public/contents/home/resume.json` |
| social links + API endpoints | `public/contents/links/links.json` |
| blog posts | `public/contents/blogs/**/*.md` |

Identity meta (`author`, `og:image`, `twitter:creator`, JSON-LD) is injected at
build from `profile.json` + `links.json` — `index.html` holds only fallbacks.

### adding a blog post

Drop a Markdown file anywhere under `public/contents/blogs/` (sub-folders are
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

```
index.html          static shell + fallback meta
vite.config.js      base path (env), classic-JSX, blog-index plugin,
                    build manifest + react vendor chunk

src/
  main.jsx          client entry: load the entry route and hydrate static HTML
  App.jsx           app shell behavior and history router
  entry-server.jsx  render the same components at build time
  routes.js         route registry: path + head meta (also read by prerender)
  lib/              data.js (PortfolioData), router.js, markdown.js (marked+hljs)
  hooks/            useWindowWidth, useCollapsed, useCopy, usePolledJSON
  components/       Nav.jsx + card/ (HeaderButtons, cardStyles, ContribGraph)
  pages/            index.js (lazy page map) + one folder per route:
    home/           Home.jsx
    projects/       Projects.jsx
    resume/         Resume.jsx
    blog/           Blog.jsx + BlogList.jsx + BlogPost.jsx + blog-ui.jsx
    links/          Links.jsx + one file per card:
                    Email, Discord, Telegram, X, GitHub, GitLab,
                    LinkedIn, Spotify, Steam
  styles/           index.css → tokens/ + core.css, plus blog.css
scripts/            Node build tooling (NOT bundled — root by convention)
  blog-index.mjs    build-time blog scanner (Vite plugin)
  prerender.mjs     static HTML/meta/JSON-LD/sitemap/feed generator (post-build)
public/contents/    all editable content
api/                Backend for the link cards. See .claude/api.md
  index.js          Worker logic (CF-vanilla, runs on CF + Node)
  server.js         Node adapter (shims caches/KV) for self-host
  wrangler.toml     Cloudflare config
  tools/            spotify-auth.html — one-off PKCE helper
deployment/         self-host the stack (run from repo root)
  Dockerfile.web    site build → nginx
  Dockerfile.api    Node → api/server.js
  nginx.conf        SPA fallback
  docker-compose.yml  web :8080 + api :8787
```

Notes:

- Blog index is generated in memory by the Vite plugin: served virtually in
  dev, emitted as `blog-data.json` at build. Raw `.md` are stripped from `dist/`.
- Fonts and markdown libs (`marked`, `highlight.js`, `mermaid`) are
  self-hosted/lazy-loaded — no third-party CDN. One variable font file covers
  every weight.
- Every JSX file imports `React` explicitly and pages are default exports wired
  in `src/pages/index.js`. Vite uses the **classic JSX transform** — keep the
  `React` import; don't switch to the automatic runtime. Routes are `React.lazy`
  chunks. The entry route is preloaded via the build manifest; other routes load on demand.
- Route titles/descriptions live in `src/routes.js`, shared by the SPA and
  `scripts/prerender.mjs` so head tags can't drift. The prerenderer also writes
  per-page JSON-LD, `sitemap.xml` (with lastmod) and `feed.xml`.

- Static HTML uses the same React components as the client, including responsive
  CSS. Public content is embedded as escaped JSON and seeds the data cache before
  hydration. Keep first-render state deterministic across Node and the browser;
  read browser-only preferences in effects. Live API data loads after hydration.
- Card styles are extracted into `src/styles/cards.css`, imported by the links
  route. Avoid injecting layout styles during rendering, which causes reload flashes.
