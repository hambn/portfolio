# Repo structure

Static React portfolio, built with Vite, deployed to GitHub Pages at
`https://hgh.dev` (base `/`; env-overridable for project-page hosting), plus a
TypeScript API for the link cards. An npm-workspaces monorepo (Node 24, see
`.nvmrc`): one lockfile and one hoisted `node_modules/` at the root.

```
.
├─ package.json            workspaces (apps/*, packages/*), engines, root-only dev
│                          tooling (eslint, prettier, typescript), and the
│                          orchestration scripts: dev / build / preview /
│                          test:* / api:* delegate with `-w @portfolio/<app>`;
│                          lint / format / check run from the root
├─ package-lock.json       the only lockfile
├─ .nvmrc                  Node major (CI and deploy read it)
├─ eslint.config.js        one flat config for every workspace (`eslint .`)
├─ .prettierrc.json        + .prettierignore (`prettier .`; content/, *.md,
│                          *.html, *.yml and generated files are excluded)
├─ .dockerignore           kept at root — the root is every image's build context
├─ .editorconfig           utf-8, 2-space indent, LF, final newline
│
├─ apps/
│  ├─ web/                 @portfolio/web — the site
│  │  ├─ index.html        Vite entry (meta/OG fallback + pre-paint theme script
│  │  │                    + chunk-reload recovery script)
│  │  ├─ vite.config.js    base path, classic-JSX, content plugin,
│  │  │                    build manifest + react vendor chunk
│  │  ├─ src/              browser app code (bundled by Vite) — tree below
│  │  ├─ public/           served as-is: CNAME (custom domain), assets/
│  │  ├─ scripts/          Node build tooling (NOT bundled)
│  │  │  ├─ blog-index.mjs     scans content/blogs/**.md → blog index
│  │  │  └─ prerender.mjs      post-build: static HTML + meta + JSON-LD + RSS feed
│  │  │                        + sitemap + robots.txt (also injects chunk preloads)
│  │  ├─ tests/
│  │  │  ├─ site.test.mjs          SEO/prerender assertions on dist/ (test:site)
│  │  │  ├─ spotify-clock.test.mjs Spotify playback clock (test:unit)
│  │  │  ├─ api-urls.test.mjs      src/lib/api.js URL building (test:unit)
│  │  │  └─ browser/               Playwright specs (hydration, metadata, providers)
│  │  ├─ playwright.config.js
│  │  ├─ Dockerfile        site build → nginx (build context: repo root)
│  │  └─ nginx.conf        static files + /api/ HTTP/WebSocket forwarding
│  │
│  └─ api/                 @portfolio/api — portable backend; guide: .agents/api.md
│     ├─ src/              app, routes, identities, links (batch), providers,
│     │                    mail (contact form), media, lib, adapters, entrypoints
│     ├─ tests/            *.test.ts (tsx), worker.test.mjs (miniflare),
│     │                    container.mjs (docker, test:container only), fixtures/
│     ├─ scripts/build.mjs esbuild bundle of the Node entrypoint → dist/server.mjs
│     ├─ tools/spotify-auth.html   one-off PKCE helper
│     ├─ tsconfig*.json    separate Node and Worker type checking
│     ├─ worker-configuration.d.ts   generated Cloudflare bindings/runtime types
│     ├─ wrangler.jsonc    deployment template (hourly Telegram/X/LinkedIn cron); api:config
│     │                    writes the gitignored wrangler.gen.jsonc
│     └─ Dockerfile        Node 24 → dist/server.mjs (build context: repo root)
│
├─ packages/
│  └─ shared/              @portfolio/shared — used by both apps, via its exports
│                          map: `@portfolio/shared/{linkedin,telegram,x}` (.js +
│                          .d.ts) and `@portfolio/shared/media` (media.ts: the
│                          media source allowlist and asset URL encoding)
│
├─ content/                ← all editable content (served at <base>/contents/)
│  ├─ home/                profile.json, resume.json
│  ├─ links/               links.json (every card is config-driven; the API
│  │                       imports it for identities)
│  └─ blogs/               *.md posts (drop a file to publish; no title = draft)
│
├─ deploy/compose.yaml     self-host the stack: web :8080 + api :8787
│                          (`docker compose -f deploy/compose.yaml up -d --build`)
├─ docs/website-audit.md   record of the cleanup/perf passes
└─ .github/
   ├─ dependabot.yml       weekly npm updates (minor + patch grouped)
   └─ workflows/
      ├─ ci.yml            pull requests: npm ci, check, Playwright (chromium)
      └─ deploy.yml        push to main: build + deploy Pages, deploy the Worker
```

`apps/web/src/`:

```
src/
├─ main.jsx             browser entry: imports font/styles, preloads the entry
│                       route chunk, then hydrates the prerendered HTML
├─ App.jsx              history router: route state, per-route <head> sync,
│                       scroll/focus handling, Suspense around lazy pages
├─ entry-server.jsx     render(route, data) used by scripts/prerender.mjs
├─ routes.js            route registry: path + <head> meta (also read by
│                       prerender and the static SEO tests)
├─ lib/
│  ├─ api.js            apiUrl / mediaUrl / socketUrl / apiContent helpers
│  ├─ data.js           PortfolioData — fetches <base>/contents/, plus a
│  │                    synchronous peek() seeded from the inlined page data
│  ├─ metadata.js       routeMetadata / pageGraph / updateDocumentMetadata —
│  │                    shared by the prerenderer and client navigation
│  ├─ router.js         navigate() / currentRoute() / routeHref() / followRoute()
│  │                    history helpers
│  ├─ storage.js        safe localStorage get/set (never throws)
│  ├─ cardState.js      shared collapsed-card store (useSyncExternalStore)
│  ├─ highlight.js      highlight.js/lib/common + extra languages
│  └─ markdown.js       self-hosted marked + highlight.js (lazy chunk)
├─ hooks/               useMediaQuery, useCollapsed, useCopy, usePolledJSON
├─ components/
│  ├─ Shell.jsx         page frame: skip link + Nav + #content
│  ├─ Nav.jsx           top nav + theme toggle (styles in core.css)
│  ├─ ErrorState.jsx    shared load-failure message + retry button
│  └─ card/             link-card chrome: HeaderButtons, cards.css, ContribGraph
├─ pages/               one folder per route (default exports)
│  ├─ index.js          lazy page map (React.lazy) + preloadPage()
│  ├─ home/             Home.jsx + Intro, Timeline/GitLog/GitRow (git-graph
│  │                    timeline; git-graph.js lays it out, BranchCard.jsx is
│  │                    the branch hover card), Stack, SectionHead,
│  │                    FooterLinks, home.css
│  ├─ projects/         Projects.jsx (live GitHub repos) + projects.css
│  ├─ resume/           Resume.jsx + resume.css (screen + @media print)
│  ├─ blog/
│  │  ├─ Blog.jsx       container: list ↔ post routing
│  │  ├─ BlogList.jsx   search + tag filter + pagination
│  │  ├─ BlogPost.jsx   markdown rendering + syntax highlighting
│  │  └─ blog-ui.jsx    fmtDate, InlineCode, ClickableTag, tag-nav helpers
│  └─ links/
│     ├─ Links.jsx      composes the cards; reads links.json
│     ├─ LinksFeed.jsx  one /links request per visit; seeds every card
│     │                 (useCardFeed) so a fresh card needs no request
│     ├─ link-cards.css  shared card header geometry for every provider card
│     ├─ link-fonts.css  brand faces the cards share (DM Sans, Roboto)
│     └─ <provider>/    Email, Discord, Telegram, X, GitHub, GitLab,
│                       LinkedIn, Spotify, Steam (JSX + CSS per folder;
│                       gitlab/fonts/ holds a latin subset of GitLab Sans;
│                       spotify/ adds useSpotifyPlayback.js + playbackClock.js)
└─ styles/
   ├─ index.css         imports fonts.css + tokens/ + core.css
   ├─ fonts.css         JetBrains Mono @font-face (latin subset only)
   ├─ blog.css          markdown rendering styles (loads with the blog route)
   ├─ core.css          shared base styles — critical path on every route
   └─ tokens/           colors.css, typography.css, spacing.css
```

Paths in the conventions below are relative to `apps/web/` unless they start
with `apps/`, `packages/` or `content/`.

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
  Page chrome uses classes, not inline `style={{…}}` objects — those are
  rebuilt every render and serialized into every prerendered page. Inline
  styles are kept for values computed at runtime (graph geometry, colours).
- **In-app links are real `<a href>`s.** Use `routeHref(page)` for the href and
  `followRoute(page)` for the click handler (`src/lib/router.js`): a plain click
  routes in place, a modified or middle click opens a new tab as usual.
- **Workspaces.** Dependencies are declared by the package that uses them
  (`apps/web`, `apps/api`, `packages/shared`); only repo-wide dev tooling sits
  in the root `package.json`. Install from the root (`npm ci`) — there is one
  lockfile. Cross-package imports go through `@portfolio/shared/*`, never a
  relative path into another workspace. Run workspace scripts from the root
  (`npm run build`) or with `-w @portfolio/web`; a trailing `--` passes flags
  through (`npm run dev -- --port 5199`).
- **`packages/shared` is an internal, unbuilt package.** Its exports map points
  at source (`media.ts` included); Vite, esbuild, tsx and TypeScript's Bundler
  resolution consume it directly. Add a new entry point to `exports` rather
  than deep-importing a file.
- **Content is data, not code.** Edit `content/`; never hardcode it. The site
  fetches it from `<base>/contents/`: `contentPlugin` in `vite.config.js` serves
  `content/` there in dev and copies it into `dist/contents/` at build.
- **Blog is auto-discovered.** No manifest. The index is generated at build
  (and served virtually in dev); raw `.md` are never copied into `dist/`. A body
  that opens with `# <its own title>` has that line dropped — the page already
  renders the title as its one `<h1>` (asserted by `test:site`).
- **node_modules is hoisted to the repo root**, outside the Vite root, so
  `index.html` never references `/node_modules/` paths. Package assets are
  imported from CSS/JS (Vite resolves them); the body-font preload is added by
  `prerender.mjs` from the fingerprinted URL in the inlined stylesheet.
- **Self-hosted.** One variable font (JetBrains Mono) and markdown libs
  (`marked`, `highlight.js`, `mermaid`) are bundled/lazy-loaded — no
  third-party CDN.
- **Fonts declare their own `@font-face`.** `@fontsource-variable` package
  entrypoints register every subset (cyrillic, greek, vietnamese…), so
  `styles/fonts.css` and `pages/links/link-fonts.css` point at the `files/`
  woff2 directly with a latin `unicode-range`. Importing the package root
  instead quietly adds four unused downloads per family.
- **SEO via prerender.** `scripts/prerender.mjs` emits a real HTML file per
  route + per post with unique title/description/canonical/OG/Twitter tags,
  explicit `robots` directives, a per-page JSON-LD `@graph`
  (Person/WebSite/BlogPosting/BreadcrumbList/…), a modulepreload hint for the
  route's lazy chunk, plus sitemap.xml (with lastmod), feed.xml and robots.txt.
  `tests/site.test.mjs` asserts all of it — run `npm run test:site` after
  touching head markup.
- **Prerender inlines the entry stylesheet** as `<style>` so the first paint
  costs no extra round-trip, and records it so `assetLinks()` doesn't link the
  same file again. Route-scoped CSS (e.g. blog.css) still loads as a link.
- **Canonical URLs end in a slash** (`/blog/`); `navigate()` pushes that form and
  the prerendered links match it.
- **GitHub Pages.** Known routes are real 200 HTML files; `404.html` is the SPA
  fallback for unknown URLs. `.nojekyll` present. The Pages artifact is
  `apps/web/dist`.
- **Docker builds use the repo root as context.** Each `apps/*/Dockerfile`
  copies the root `package*.json` and every workspace `package.json`, runs
  `npm ci --workspace <its package>` (only its own dependencies), then copies
  the sources it needs. A new workspace needs its `package.json` added to both
  Dockerfiles or `npm ci` rejects the lockfile.

## Common edits

- New blog post → add `content/blogs/<name>.md` with frontmatter.
- Change a social link → edit `content/links/links.json`.
- Update bio / resume → `content/home/*.json`.
- Add a route → add the component in `apps/web/src/pages/`, register it in
  `apps/web/src/pages/index.js`, and add its meta to `apps/web/src/routes.js`.
- Restyle → `apps/web/src/styles/tokens/` (design tokens) or
  `apps/web/src/styles/core.css` for shared chrome; page-specific rules go in
  that page's own CSS file.
- Add a dependency → `npm install <pkg> -w @portfolio/web` (or `@portfolio/api`),
  never at the root unless it is repo-wide dev tooling.
- `npm run dev` to preview, `npm run build` to produce `apps/web/dist/`.
- `npm run check` before shipping (lint + api checks + web unit tests + format
  + build + SEO tests); `npm run test:browser` for the Playwright regressions.
  Pull requests run both in `.github/workflows/ci.yml`.
