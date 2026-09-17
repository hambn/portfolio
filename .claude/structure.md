# Repo structure

Static React portfolio, built with Vite, deployed to GitHub Pages at
`https://hgh.dev` (base `/`; env-overridable for project-page hosting).

```
.
├─ index.html              Vite entry (meta/OG fallback + pre-paint theme script)
├─ vite.config.js          base path, classic-JSX, blog-index plugin,
│                          build manifest + react vendor chunk
├─ package.json            scripts: dev / build / preview
│
├─ src/                    browser app code (bundled by Vite)
│  ├─ main.jsx             entry: app shell + history router; syncs
│  │                       document.title/scroll/focus per route; imports
│  │                       font/styles, preloads the entry route chunk, then
│  │                       prefetches the rest when idle
│  ├─ routes.js            route registry: path + <head> meta (also read by prerender)
│  ├─ lib/
│  │  ├─ data.js           PortfolioData — fetches public/contents/
│  │  ├─ router.js         navigate() / currentRoute() history helpers
│  │  ├─ storage.js        safe localStorage get/set (never throws)
│  │  └─ markdown.js       self-hosted marked + highlight.js (lazy chunk)
│  ├─ hooks/               useWindowWidth, useCollapsed, useCopy, usePolledJSON
│  ├─ components/
│  │  ├─ Nav.jsx           top nav + theme toggle
│  │  ├─ ErrorState.jsx    shared load-failure message + retry button
│  │  └─ card/             link-card chrome: HeaderButtons, cardStyles, ContribGraph
│  ├─ pages/               one folder per route (default exports)
│  │  ├─ index.js          lazy page map (React.lazy) + preloadPage()
│  │  ├─ home/Home.jsx
│  │  ├─ projects/Projects.jsx   live GitHub repos
│  │  ├─ resume/Resume.jsx
│  │  ├─ blog/
│  │  │  ├─ Blog.jsx       container: list ↔ post routing
│  │  │  ├─ BlogList.jsx   search + tag filter + pagination
│  │  │  ├─ BlogPost.jsx   markdown rendering + syntax highlighting
│  │  │  └─ blog-ui.jsx    fmtDate, InlineCode, ClickableTag, tag-nav helpers
│  │  └─ links/
│  │     ├─ Links.jsx      composes the cards; reads links.json
│  │     └─ *Card.jsx      Email, Discord, Telegram, X, GitHub, GitLab,
│  │                       LinkedIn, Spotify, Steam (one file each)
│  └─ styles/
│     ├─ index.css         imports tokens/ + core.css
│     ├─ blog.css          markdown rendering styles
│     ├─ core.css          component base styles
│     └─ tokens/           colors.css, typography.css, spacing.css
│
├─ scripts/                Node build tooling (NOT bundled — root by convention)
│  ├─ blog-index.mjs       scans contents/blogs/*.md → blog index (Vite plugin)
│  └─ prerender.mjs        post-build: static HTML + meta + JSON-LD + RSS feed
│                          + sitemap per route (also injects chunk preloads)
│
├─ public/                 served as-is (not processed by Vite)
│  ├─ robots.txt
│  └─ contents/            ← all editable content
│     ├─ home/             profile.json, resume.json
│     ├─ links/            links.json (every card is config-driven)
│     └─ blogs/            *.md posts (drop a file to publish; no title = draft)
│
├─ api/                    Portable TypeScript backend; guide: .claude/api.md
│  ├─ src/                 app, providers, media, lib, adapters, entrypoints
│  ├─ tests/               network-free API and persistent-storage regressions
│  ├─ tsconfig*.json       separate Node and Worker type checking
│  ├─ worker-configuration.d.ts   generated Cloudflare bindings/runtime types
│  ├─ wrangler.toml        deployment template, hourly Telegram cron
│  └─ tools/spotify-auth.html   one-off PKCE helper
│
├─ deployment/             self-host the stack (run compose from repo root)
│  ├─ Dockerfile.web       site build → nginx
│  ├─ Dockerfile.api       Node 24 → api/dist/server.mjs
│  ├─ nginx.conf           static files + /api/ HTTP/WebSocket forwarding
│  └─ docker-compose.yml   web :8080 + api :8787
│
├─ .dockerignore           kept at root — Docker needs it at the build context
└─ .github/workflows/deploy.yml   build + deploy to Pages on push to main
```

## Key conventions

- **Classic JSX, explicit React.** `vite.config.js` uses the classic JSX
  transform (`React.createElement`), so every `.jsx` file imports React itself.
  Do NOT switch to the automatic runtime.
- **Pages are default exports** wired together in `src/pages/index.js` as lazy
  chunks (`React.lazy`); `main.jsx` preloads the entry route and prefetches the
  rest once idle.
- **Route metadata lives in `src/routes.js`** — plain JS, also imported by
  `scripts/prerender.mjs`, so the prerendered head and the SPA never drift.
- **Content is data, not code.** Edit `public/contents/`; never hardcode it.
- **Blog is auto-discovered.** No manifest. The index is generated at build
  (and served virtually in dev); raw `.md` are stripped from `dist/`.
- **Self-hosted.** One variable font (`@fontsource-variable/jetbrains-mono`) and
  markdown libs (`marked`, `highlight.js`, `mermaid`) are bundled/lazy-loaded —
  no third-party CDN.
- **SEO via prerender.** `scripts/prerender.mjs` emits a real HTML file per
  route + per post with unique title/description/canonical/OG, per-page JSON-LD
  (BlogPosting/BreadcrumbList/…), a modulepreload hint for the route's lazy
  chunk, plus sitemap.xml (with lastmod) and feed.xml.
- **Canonical URLs end in a slash** (`/blog/`); `navigate()` pushes that form and
  the prerendered links match it.
- **GitHub Pages.** Known routes are real 200 HTML files; `404.html` is the SPA
  fallback for unknown URLs. `.nojekyll` present.

## Common edits

- New blog post → add `public/contents/blogs/<name>.md` with frontmatter.
- Change a social link → edit `public/contents/links/links.json`.
- Update bio / resume → `public/contents/home/*.json`.
- Add a route → add the component in `src/pages/`, register it in
  `src/pages/index.js`, and add its meta to `src/routes.js`.
- Restyle → `src/styles/tokens/` (design tokens) or `src/styles/core.css`.
- `npm run dev` to preview, `npm run build` to produce `dist/`.
