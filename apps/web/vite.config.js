import { defineConfig } from 'vite';
process.env.VITE_API_BASE_URL ||= 'https://api.portfolio.hgh.dev';
import { fileURLToPath } from 'node:url';
import { cpSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { buildBlogIndex } from './scripts/blog-index.mjs';

// Editable content lives at the repo root (content/) because the API reads it
// too. The site serves it at <base>/contents/ exactly as if it sat in public/.
const contentDir = fileURLToPath(new URL('../../content', import.meta.url));
const blogsDir = join(contentDir, 'blogs');
const CONTENTS = 'contents/';
const INDEX_PATH = 'blogs/blog-data.json';
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
// at build. The blog index is built from the .md files — never written to disk.
// In dev a middleware serves it fresh per request; at build it's emitted as an
// asset.
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
      console.log(`[blog] indexed ${count} post(s)`);
    },
    closeBundle() {
      // Only the generated index is used at runtime, so the raw .md posts (and
      // anything else under blogs/) stay out of dist — the live site ships just
      // blog-data.json there.
      cpSync(contentDir, join(outDir, CONTENTS), {
        recursive: true,
        filter: (src) => src !== blogsDir && !src.startsWith(blogsDir + sep),
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
