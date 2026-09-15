# Repo structure

Static React portfolio, built with Vite, deployed to GitHub Pages at
`https://hgh.dev` (base `/`; env-overridable for project-page hosting).

```
.
├─ index.html              Vite entry (meta/OG/JSON-LD live here)
├─ vite.config.js          base path, classic-JSX, blog-index plugin
├─ package.json            scripts: dev / build / preview
│
├─ src/                    browser app code (bundled by Vite)
│  ├─ main.jsx             entry: app shell + history router; imports fonts/styles
│  ├─ routes.js            route registry: path + <head> meta (also read by prerender)
│  ├─ lib/
│  │  ├─ data.js           PortfolioData — fetches public/contents/
│  │  ├─ router.js         navigate() / currentRoute() history helpers
│  │  └─ markdown.js       self-hosted marked + highlight.js (lazy chunk)
│  ├─ hooks/               useWindowWidth, useCollapsed, useCopy, usePolledJSON
│  ├─ components/
│  │  ├─ Nav.jsx           top nav + theme toggle
│  │  └─ card/             link-card chrome: HeaderButtons, cardStyles, ContribGraph
│  ├─ pages/               one folder per route (default exports)
│  │  ├─ index.js          pages map the router renders from
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
│  └─ prerender.mjs        post-build: static HTML + meta + sitemap per route
│
├─ public/                 served as-is (not processed by Vite)
│  ├─ robots.txt
│  └─ contents/            ← all editable content
│     ├─ home/             profile.json, resume.json
│     ├─ links/            links.json (every card is config-driven)
│     └─ blogs/            *.md posts (drop a file to publish; no title = draft)
│
├─ api/                    Backend (api.portfolio.hgh.dev) — proxies Spotify/
│  ├─ index.js             Discord/Steam for the link cards. Worker logic;
│  │                       keep CF-vanilla. Deploy: `npm run api:deploy`.
│  ├─ server.js            Node adapter (shims caches/KV) → `npm run api:serve`
│  │                       self-hosts the same index.js. No CI.
│  ├─ wrangler.toml        Guide: .claude/api.md
│  └─ tools/spotify-auth.html   one-off PKCE helper
│
├─ deployment/             self-host the stack (run compose from repo root)
│  ├─ Dockerfile.web       site build → nginx
│  ├─ Dockerfile.api       Node → api/server.js
│  ├─ nginx.conf           SPA fallback
│  └─ docker-compose.yml   web :8080 + api :8787
│
├─ .dockerignore           kept at root — Docker needs it at the build context
└─ .github/workflows/deploy.yml   build + deploy to Pages on push to main
```

## Key conventions

- **Classic JSX, explicit React.** `vite.config.js` uses the classic JSX
  transform (`React.createElement`), so every `.jsx` file imports React itself.
  Do NOT switch to the automatic runtime.
- **Pages are default exports** wired together in `src/pages/index.js`; the app
  shell in `main.jsx` renders the map entry for the current route.
- **Route metadata lives in `src/routes.js`** — plain JS, also imported by
  `scripts/prerender.mjs`, so the prerendered head and the SPA never drift.
- **Content is data, not code.** Edit `public/contents/`; never hardcode it.
- **Blog is auto-discovered.** No manifest. The index is generated at build
  (and served virtually in dev); raw `.md` are stripped from `dist/`.
- **Self-hosted.** Fonts (`@fontsource`) and markdown libs (`marked`,
  `highlight.js`, `mermaid`) are bundled/lazy-loaded — no third-party CDN.
- **SEO via prerender.** `scripts/prerender.mjs` emits a real HTML file per
  route + per post with unique title/description/canonical/OG, plus sitemap.xml.
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
