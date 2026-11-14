import { defineConfig } from 'vite';
process.env.VITE_API_BASE_URL ||= 'https://api.portfolio.hgh.dev';
import { fileURLToPath } from 'node:url';
import { cpSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { buildBlogIndex } from './scripts/blog-index.mjs';
import { renderPost } from './scripts/render-post.mjs';
import './scripts/build-info.mjs';

// Editable content lives at the repo root (content/) because the API reads it
// too. The site serves it at <base>/contents/ exactly as if it sat in public/.
const contentDir = fileURLToPath(new URL('../../content', import.meta.url));
const blogsDir = join(contentDir, 'blogs');
const CONTENTS = 'contents/';
const INDEX_PATH = 'blogs/blog-data.json';
// One rendered post per file: what the blog fetches when a post is opened from
// another page (a post's own page already carries its HTML).
const POST_PATH = /^blogs\/posts\/([a-z0-9][a-z0-9-]*)\.json$/;
const postFile = (post) => JSON.stringify({ html: renderPost(post.body) });
const TYPES = {
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

// Serves content/ at <base>/contents/ in dev and copies it into dist/contents/
// at build. The blog index and each post's rendered HTML are built from the .md
// files — never written to disk. In dev a middleware serves them fresh per
// request; at build they're emitted as assets.
function contentPlugin() {
  let outDir;
  return {
    name: 'content',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      const prefix = server.config.base + CONTENTS;
      server.middlewares.use((req, res, next) => {
        let pathname;
        try {
          pathname = decodeURIComponent((req.url || '').split('?')[0]);
        } catch {
          return next();
        }
        if (!pathname.startsWith(prefix)) return next();
        const path = pathname.slice(prefix.length);
        if (path === INDEX_PATH) {
          res.setHeader('Content-Type', 'application/json');
          res.end(buildBlogIndex(blogsDir).json);
          return;
        }
        const slug = POST_PATH.exec(path)?.[1];
        if (slug) {
          const post = JSON.parse(buildBlogIndex(blogsDir).json).find((p) => p.slug === slug);
          if (!post) return next();
          res.setHeader('Content-Type', 'application/json');
          res.end(postFile(post));
          return;
        }
        const file = resolve(contentDir, path);
        if (!file.startsWith(contentDir + sep)) return next();
        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          return next();
        }
        res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      const { json, count } = buildBlogIndex(blogsDir);
      this.emitFile({ type: 'asset', fileName: CONTENTS + INDEX_PATH, source: json });
      for (const post of JSON.parse(json))
        this.emitFile({
          type: 'asset',
          fileName: `${CONTENTS}blogs/posts/${post.slug}.json`,
          source: postFile(post),
        });
      console.log(`[blog] indexed ${count} post(s)`);
    },
    closeBundle() {
      // Only the generated index and rendered posts are used at runtime, so the
      // raw .md posts (and anything else under blogs/) stay out of dist — the
      // live site ships just blog-data.json and posts/<slug>.json there.
      cpSync(contentDir, join(outDir, CONTENTS), {
        recursive: true,
        filter: (src) =>
          src !== blogsDir &&
          !src.startsWith(blogsDir + sep) &&
          src !== join(contentDir, 'README.md'),
      });
    },
  };
}

// base = deploy route. Default '/' (custom domain hgh.dev). Override per env,
// e.g. BASE_PATH=/portfolio/ for a github.io project page.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [contentPlugin()],
  server: { proxy: { '/api/': { target: 'http://localhost:8787', ws: true } } },
  build: {
    // Emit .vite/manifest.json so the prerenderer can add modulepreload links
    // for each route's lazy chunk (scripts/prerender.mjs reads then removes it).
    manifest: true,
    rollupOptions: {
      output: {
        // React gets its own long-lived chunk: its hash stays stable across app
        // deploys, so browser/CDN caches keep it instead of refetching.
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react';
          }
        },
      },
    },
  },
  esbuild: {
    // Classic JSX (React.createElement) — every JSX file imports React itself.
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});
