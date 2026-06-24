# portfolio

Personal portfolio for **hamed ghasempour** (@hambn). Static React site built
with Vite, deployed to GitHub Pages at https://hambn.github.io/portfolio/.

## develop

```bash
npm install
npm run dev        # http://localhost:5173/portfolio/
npm run build      # → dist/  (also writes 404.html + .nojekyll for Pages)
npm run preview    # serve the production build locally
```

Pushing to `main` builds and deploys automatically (`.github/workflows/deploy.yml`).
Set repo **Settings → Pages → Source** to **GitHub Actions** once.

## editing content

All content lives in `public/contents/` — no code changes needed.

| What | File |
|------|------|
| name, handle, bio, avatar | `public/contents/home/profile.json` |
| work / education / skills | `public/contents/home/resume.json` |
| social links + API endpoints | `public/contents/links/links.json` |
| blog posts | `public/contents/blogs/**/*.md` |

### adding a blog post

Drop a Markdown file anywhere under `public/contents/blogs/` (sub-folders are
fine for organising). Start it with frontmatter:

```markdown
---
title: Building a NixOS Homelab
date: 2026-05-12
description: One-line summary shown in the list and meta tags.
tags: [nixos, homelab, devops]
---

your post body in GitHub-flavored markdown…
```

- The index is generated automatically at build/dev time — there is **no
  manifest to update**.
- The route is `/blog/<filename-without-.md>`, so keep filenames unique.
- **To hide a draft**, omit the `title` frontmatter — files without a title are
  skipped. (`hello-world.md` is an example draft.)

## structure

```
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
scripts/            Node build tooling (NOT bundled — root-level by convention)
  blog-index.mjs    build-time blog scanner (Vite plugin)
  prerender.mjs     static HTML/meta/sitemap generator (post-build)
public/contents/    all editable content
```

Notes:
- The blog index is generated in memory by the Vite plugin (`vite.config.js`):
  served virtually in dev, emitted as `blog-data.json` at build. The raw `.md`
  files are stripped from `dist/` (only the index ships).
- `mermaid` is loaded from CDN on demand, only when a post has a diagram.

The page components are reused from the design kit. They reference a global
`React` and register themselves on `window` (e.g. `window.Home`); `main.jsx`
imports them for that side effect, then the router reads them off `window`.
Vite uses the classic JSX transform (`vite.config.js`) so the global-`React`
pattern keeps working — don't switch to the automatic runtime.
