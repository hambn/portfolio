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

The Spotify / Discord / Steam link cards read live data from a small backend in
`api/` (one file, `index.js`). The **same code** runs two ways:

### Cloudflare Worker (current — free)

Served at `https://api.portfolio.hgh.dev`. Nothing sensitive is committed —
`api:deploy` injects every value at deploy time via `wrangler --var`, read from
your shell env (locally) or GitHub Actions secrets (CI).

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

Pages deploy needs no secrets — GitHub's `GITHUB_TOKEN` is automatic. `STEAM_ID`
and `DISCORD_ID` are public on your profiles; kept as secrets only so nothing
identifying sits in git.

#### Manual deploy

Export the same vars, then `npm run api:deploy`:

```bash
export SPOTIFY_KV_ID=… SPOTIFY_CLIENT_ID=… SPOTIFY_REFRESH_TOKEN=… STEAM_API_KEY=… STEAM_ID=… DISCORD_ID=…
npm run api:deploy
```

| Route | Cache | Data |
|-------|-------|------|
| `GET /spotify` | none | aggregate: now-playing + profile + top + recent + playlists |
| `GET /spotify/status` | none | currently playing |
| `GET /spotify/profile` | 1h | profile |
| `GET /spotify/favorites?type=tracks\|artists&range=…` | 1h | top tracks/artists |
| `GET /spotify/recent` | 5m | recently played |
| `GET /steam` | 5m | status, level, current/favorite game, recent activity |
| `GET /discord` | 60s | presence + activities + Spotify (via Lanyard) |

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
vite.config.js      base path (env), classic-JSX, blog-index plugin

src/
  main.jsx          entry: history router + page mounting
  globals.js        exposes React/ReactDOM + content base globally
  data.js           PortfolioData — fetches contents/
  components/Nav.jsx
  pages/            Home, Projects, Resume
    blog/           Blog.jsx + blog-libs.js (self-hosted marked/hljs)
    links/          Links.jsx + one file per card:
                    Email, Discord, Telegram, X, GitHub, GitLab,
                    LinkedIn, Spotify, Steam, plus shared.jsx
  styles/           index.css → tokens/ + core.css, plus blog.css
scripts/            Node build tooling (NOT bundled — root by convention)
  blog-index.mjs    build-time blog scanner (Vite plugin)
  prerender.mjs     static HTML/meta/sitemap/robots generator (post-build)
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
  self-hosted/lazy-loaded — no third-party CDN.
- Pages reference a global `React` and register on `window` (e.g.
  `window.Home`); `main.jsx` imports them for the side effect, the router reads
  them off `window`. Vite uses the **classic JSX transform** — don't switch to
  the automatic runtime, it breaks this.
