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
│  │  │  ├─ render-post.mjs    post Markdown → finished HTML (marked +
│  │  │  │                     highlight.js + code/heading/table chrome)
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
│                          map: `@portfolio/shared/{linkedin,telegram,x}` (username
│                          parsing), `@portfolio/shared/github` (profile shaping the
│                          API and the direct-to-GitHub card share),
                          `@portfolio/shared/gitlab` (GitLab paths and the
                          activity calendar), `@portfolio/shared/projects`
                          (content model and the git hosts' repo mappers) and
│                          `@portfolio/shared/media` (media.ts: the
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
│  ├─ siteFeed.js       the one API request per visit: /site answers every
│  │                    link card and the projects listing; ensureCards(),
│  │                    useSiteCard(), warmSite() (also preloads the other
│  │                    pages' content and code on idle)
│  ├─ storage.js        safe localStorage get/set (never throws)
│  ├─ cardState.js      shared collapsed-card store (useSyncExternalStore)
│  ├─ external.js       EXTERNAL — the target/rel props every off-site link spreads
│  └─ languages.js      GitHub linguist colours (projects + GitHub card)
├─ hooks/               useMediaQuery, useCollapsed, useCopy, usePolledJSON,
│                       useCardSource (API first, provider as fallback),
│                       useContent (one piece of content: data, error, retry)
├─ components/
│  ├─ Shell.jsx         page frame: skip link + Nav + #content
│  ├─ Nav.jsx           top nav + theme toggle (styles in core.css)
│  ├─ Keys.jsx          keyboard shortcuts (g h/p/b/l/r, j/k, /, [ ], t, ?) + their footer panel
│  ├─ Palette.jsx       command palette (ctrl/cmd+k or :), lazy-loaded with palette.css
│  ├─ NotFound.jsx      the view for a URL with no page or post behind it
│  ├─ ErrorState.jsx    shared load-failure message + retry button
│  └─ card/             link-card chrome: HeaderButtons, cards.css, ContribGraph
├─ pages/               one folder per route (default exports)
│  ├─ index.js          lazy page map (React.lazy) + preloadPage()
│  ├─ home/             Home.jsx + Intro, Timeline/GitLog/GitRow (git-graph
│  │                    timeline; git-graph.js lays it out, BranchCard.jsx is
│  │                    the branch hover card), RecentPosts (newest three
│  │                    posts), Stack, SectionHead,
│  │                    FooterLinks, home.css
│  ├─ projects/         Projects.jsx (featured cards from content, then one
│  │                    /projects request for every host) + projects.css;
│  │                    directProjects.js lists the hosts from the browser
│  │                    when the API is unreachable
│  ├─ resume/           Resume.jsx + resume.css (screen + @media print)
│  ├─ blog/
│  │  ├─ Blog.jsx       container: list ↔ post routing
│  │  ├─ BlogList.jsx   search + tag filter + pagination
│  │  ├─ BlogPost.jsx   shows the build's rendered post; draws diagrams
│  │  └─ blog-ui.jsx    fmtDate, InlineCode, ClickableTag, tag-nav helpers
│  └─ links/
│     ├─ Links.jsx      composes the cards; reads links.json
│     ├─ JumpBar.jsx    the chip per card that jumps to it and opens/collapses it
│     ├─ useIsland.js   docks the jump bar into the nav (shape: islandShape.js)
│     ├─ LinksFeed.jsx  asks lib/siteFeed.js for the cards not already fresh;
│     │                 seeds every card (useCardFeed) so it needs no request
│     ├─ link-cards.css  shared card header geometry for every provider card
│     ├─ link-fonts.css  brand faces the cards share (DM Sans, Roboto)
│     └─ <provider>/    Email, Discord, Telegram, X, GitHub, GitLab,
│                       LinkedIn, Spotify, Steam (JSX + CSS per folder;
│                       gitlab/fonts/ holds a latin subset of GitLab Sans;
│                       spotify/ adds useSpotifyPlayback.js + playbackClock.js,
│                       discord/ useLanyardPresence.js, the live socket,
│                       github/ octicons.js, the MIT Octicon paths)
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
  (and served virtually in dev); raw `.md` are never copied into `dist/`.
- **Posts are rendered at build, not in the browser.** `scripts/render-post.mjs`
  turns a post's Markdown into its final HTML: parsed, syntax-highlighted, with
  the code-block label and copy button, heading anchors and table wrappers. A
  post's own page carries that HTML inline; opened from another page it is one
  small fetch of `contents/blogs/posts/<slug>.json` (started when its link is
  hovered). `marked` and `highlight.js` are build tooling and must not be
  imported from `src/`; only Mermaid, for posts with a diagram, loads in the
  browser. A body
  that opens with `# <its own title>` has that line dropped — the page already
  renders the title as its one `<h1>` (asserted by `test:site`).
- **node_modules is hoisted to the repo root**, outside the Vite root, so
  `index.html` never references `/node_modules/` paths. Package assets are
  imported from CSS/JS (Vite resolves them). There is deliberately no font
  preload: Chrome holds the first paint for a preloaded font.
- **Self-hosted.** One variable font (JetBrains Mono) is bundled and `mermaid`
  is lazy-loaded — no third-party CDN.
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
  For agents it also writes `llms.txt` (an index), `llms-full.txt` (every post
  in one file) and a raw `blog/<slug>.md` per post, linked from the post's head
  as `rel="alternate" type="text/markdown"`.
  `tests/site.test.mjs` asserts all of it — run `npm run test:site` after
  touching head markup.
- **Prerender inlines the entry stylesheet** as `<style>` so the first paint
  costs no extra round-trip, and records it so `assetLinks()` doesn't link the
  same file again. The route's own CSS is inlined the same way on its
  prerendered pages; on client navigation it loads as a link. Each inlined file
  also gets a script-created disabled `<link>`, so Vite's preload helper sees
  it as present and does not download it again before rendering a route.
- **The site works without the API.** Content renders every page; the API only
  adds live data. Anything a browser can read from the provider is fetched
  there when the API is unreachable: GitHub, GitLab and Discord cards
  (`hooks/useCardSource.js`), the projects listing
  (`pages/projects/directProjects.js`) and every proxied image
  (`installMediaFallback` in `lib/api.js` swaps a failed `/media/…` URL for the
  provider's own). Shaping shared by both sources lives in `packages/shared`
  (`github`, `gitlab`, `projects`), so a card gets one shape either way. A card
  with no source shows its links and says so; nothing is ever invented (the
  contribution graph is left out rather than drawn from placeholder data).
- **The projects page makes one request.** Its featured cards are prerendered
  from `content/projects/projects.json`; `/projects` on the API then supplies
  stars, languages and every host's repository list in a single response. The
  last answer is kept in localStorage and shown on the next visit while the
  request runs. Do not add a second request to that page.
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
- Choose where a card's data comes from → `apiEndpoint` in `links.json`. Set,
  the card reads this site's API (cached; GitHub with the status, achievements,
  pinned repositories and README only the profile page shows, GitLab with its
  real activity calendar) and falls back to the provider if the API fails.
  Removed from `github` or `gitlab`, the visitor's browser asks the provider
  itself and the API is never asked for that card (`hooks/useCardSource.js`;
  answers are kept in localStorage for an hour).
- Card header buttons (copy / open / collapse) are one component and one set of
  rules for every card: `components/card/HeaderButtons.jsx` and
  `.link-card-hdr-btn` in `pages/links/link-cards.css`. A card passes its accent
  and titles only, never its own button classes.
- Need API data on a page → add it to the `cards` table in `apps/api/src/links.ts`
  and read it with `useSiteCard(key)`; do not add a per-page fetch.
- Update bio / resume → `content/home/*.json`.
- Feature a project, reorder them, or add a git account →
  `content/projects/projects.json` (see `content/README.md`); redeploy the API
  too, since it reads the same file.
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
