# Repo structure

Static React portfolio, built with Vite, deployed to GitHub Pages at
`https://hambn.github.io/portfolio/` (base `/portfolio/`).

```
.
├─ index.html              Vite entry (meta/OG/JSON-LD live here)
├─ vite.config.js          base path, classic-JSX, blog-index plugin
├─ package.json            scripts: dev / build / preview
│
├─ src/                    browser app code (bundled by Vite)
│  ├─ main.jsx             entry: history router + mounts pages; imports fonts/styles
│  ├─ globals.js           exposes window.React/ReactDOM + CONTENT_BASE
│  ├─ data.js              PortfolioData — fetches public/contents/
│  ├─ components/
│  │  └─ Nav.jsx           top nav + theme toggle
│  ├─ pages/               one page per route (register on window for the router)
│  │  ├─ Home.jsx
│  │  ├─ Projects.jsx      live GitHub repos
│  │  ├─ Resume.jsx
│  │  ├─ blog/
│  │  │  ├─ Blog.jsx       list + post view (markdown)
│  │  │  └─ blog-libs.js   self-hosted marked + highlight.js (lazy chunk)
│  │  └─ links/
│  │     ├─ Links.jsx      composes the cards; reads links.json
│  │     ├─ shared.jsx     ensureScStyles, ContribGraph, ICON_PATHS
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
└─ .github/workflows/deploy.yml   build + deploy to Pages on push to main
```

## Key conventions

- **Global React + classic JSX.** Components use a bare `React` (set on `window`
  in `globals.js`); `vite.config.js` uses the classic JSX transform. Do NOT
  switch to the automatic runtime — it breaks this.
- **Pages register on `window`** (`window.Home`, etc.) so the router in
  `main.jsx` can resolve them. Cards are plain ES-module imports in `Links.jsx`.
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
- Restyle → `src/styles/tokens/` (design tokens) or `src/styles/core.css`.
- `npm run dev` to preview, `npm run build` to produce `dist/`.
