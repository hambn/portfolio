# Repo structure

Static React portfolio, built with Vite, deployed to GitHub Pages at
`https://hgh.dev` (base `/`; env-overridable for project-page hosting).

```
.
├─ index.html              Vite entry (meta/OG fallback + pre-paint theme script
│                          + chunk-reload recovery script)
├─ vite.config.js          base path, classic-JSX, blog-index plugin,
│                          build manifest + react vendor chunk
├─ package.json            scripts: dev / build / preview / lint / check / test:*
│
├─ src/                    browser app code (bundled by Vite)
│  ├─ main.jsx             browser entry: imports font/styles, preloads the entry
│  │                       route chunk, then hydrates the prerendered HTML
│  ├─ App.jsx              history router: route state, per-route <head> sync,
│  │                       scroll/focus handling, Suspense around lazy pages
│  ├─ entry-server.jsx     render(route, data) used by scripts/prerender.mjs
│  ├─ routes.js            route registry: path + <head> meta (also read by
│  │                       prerender and the static SEO tests)
│  ├─ lib/
│  │  ├─ api.js            apiUrl / mediaUrl / socketUrl / apiContent helpers
│  │  ├─ data.js           PortfolioData — fetches public/contents/, plus a
│  │  │                    synchronous peek() seeded from the inlined page data
│  │  ├─ metadata.js       routeMetadata / pageGraph / updateDocumentMetadata —
│  │  │                    shared by the prerenderer and client navigation
│  │  ├─ router.js         navigate() / currentRoute() history helpers
│  │  ├─ storage.js        safe localStorage get/set (never throws)
│  │  ├─ cardState.js      shared collapsed-card store (useSyncExternalStore)
│  │  ├─ highlight.js      highlight.js/lib/common + extra languages
│  │  └─ markdown.js       self-hosted marked + highlight.js (lazy chunk)
│  ├─ hooks/               useMediaQuery, useCollapsed, useCopy, usePolledJSON
│  ├─ components/
│  │  ├─ Shell.jsx         page frame: skip link + Nav + #content
│  │  ├─ Nav.jsx           top nav + theme toggle (styles in core.css)
│  │  ├─ ErrorState.jsx    shared load-failure message + retry button
│  │  └─ card/             link-card chrome: HeaderButtons, cards.css, ContribGraph
│  ├─ pages/               one folder per route (default exports)
│  │  ├─ index.js          lazy page map (React.lazy) + preloadPage()
│  │  ├─ home/             Home.jsx + Intro, Timeline/GitLog/GitRow (git-graph
│  │  │                    timeline), Stack, SectionHead, FooterLinks
│  │  ├─ projects/         Projects.jsx (live GitHub repos) + projects.css
│  │  ├─ resume/Resume.jsx
│  │  ├─ blog/
│  │  │  ├─ Blog.jsx       container: list ↔ post routing
│  │  │  ├─ BlogList.jsx   search + tag filter + pagination
│  │  │  ├─ BlogPost.jsx   markdown rendering + syntax highlighting
│  │  │  └─ blog-ui.jsx    fmtDate, InlineCode, ClickableTag, tag-nav helpers
│  │  └─ links/
│  │     ├─ Links.jsx      composes the cards; reads links.json
│  │     ├─ LinksFeed.jsx  one /links request per visit; seeds every card
│  │     │                 (useCardFeed) so a fresh card needs no request
│  │     └─ <provider>/    Email, Discord, Telegram, X, GitHub, GitLab,
│  │                       LinkedIn, Spotify, Steam (JSX + CSS per folder)
│  └─ styles/
│     ├─ index.css         imports tokens/ + core.css
│     ├─ blog.css          markdown rendering styles (loads with the blog route)
│     ├─ core.css          shared base styles — critical path on every route
│     └─ tokens/           colors.css, typography.css, spacing.css
│
├─ shared/                 tiny helpers used by both the site and api/
│                          (linkedin, telegram, x — .js + .d.ts)
│
├─ scripts/                Node build tooling (NOT bundled — root by convention)
│  ├─ blog-index.mjs       scans contents/blogs/**.md → blog index (Vite plugin)
│  ├─ prerender.mjs        post-build: static HTML + meta + JSON-LD + RSS feed
│  │                       + sitemap + robots.txt (also injects chunk preloads)
│  ├─ build-api.mjs        esbuild bundle of api/ for the Node entrypoint
│  └─ test-*.mjs           node:test suites (site SEO, worker, api urls, …)
│
├─ tests/browser/          Playwright specs (hydration, metadata, providers)
├─ docs/website-audit.md   record of the cleanup/perf passes
│
├─ public/                 served as-is (not processed by Vite)
│  ├─ CNAME                custom domain for GitHub Pages
│  └─ contents/            ← all editable content
│     ├─ home/             profile.json, resume.json
│     ├─ links/            links.json (every card is config-driven)
│     └─ blogs/            *.md posts (drop a file to publish; no title = draft)
│
├─ api/                    Portable TypeScript backend; guide: .claude/api.md
│  ├─ src/                 app, routes, identities, links (batch), providers,
│  │                       mail (contact form), media, lib, adapters, entrypoints
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
  chunks (`React.lazy`); `main.jsx` preloads the entry route before hydration. Other routes load when opened.
- **Route metadata lives in `src/routes.js`** — plain JS, also imported by
  `scripts/prerender.mjs`, so the prerendered head and the SPA never drift.
  `src/lib/metadata.js` builds the actual titles/descriptions/JSON-LD for both.
- **`src/styles/core.css` is render-blocking on every route.** Styles used by a
  single page belong in a CSS file next to that page (Vite splits it into the
  route chunk), not here. Nothing unused should survive in core.css.
- **Styling lives in CSS, not in state.** Hover/active are `:hover` and
  `[aria-current]` selectors so pointer movement never re-renders React.
- **Content is data, not code.** Edit `public/contents/`; never hardcode it.
- **Blog is auto-discovered.** No manifest. The index is generated at build
  (and served virtually in dev); raw `.md` are stripped from `dist/`.
- **Self-hosted.** One variable font (`@fontsource-variable/jetbrains-mono`) and
  markdown libs (`marked`, `highlight.js`, `mermaid`) are bundled/lazy-loaded —
  no third-party CDN.
- **SEO via prerender.** `scripts/prerender.mjs` emits a real HTML file per
  route + per post with unique title/description/canonical/OG/Twitter tags,
  explicit `robots` directives, a per-page JSON-LD `@graph`
  (Person/WebSite/BlogPosting/BreadcrumbList/…), a modulepreload hint for the
  route's lazy chunk, plus sitemap.xml (with lastmod), feed.xml and robots.txt.
  `scripts/test-site.mjs` asserts all of it — run `npm run test:site` after
  touching head markup.
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
- Restyle → `src/styles/tokens/` (design tokens) or `src/styles/core.css` for
  shared chrome; page-specific rules go in that page's own CSS file.
- `npm run dev` to preview, `npm run build` to produce `dist/`.
- `npm run check` before shipping (lint + api checks + format + build + SEO
  tests); `npm run test:browser` for the Playwright regressions.
