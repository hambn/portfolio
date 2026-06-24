import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildBlogIndex } from './scripts/blog-index.mjs';

const blogsDir = fileURLToPath(new URL('./public/contents/blogs', import.meta.url));
const distBlogs = fileURLToPath(new URL('./dist/contents/blogs', import.meta.url));
const INDEX_PATH = '/contents/blogs/blog-data.json';

// The blog index is built from the .md files — never written to disk. In dev a
// middleware serves it fresh per request; at build it's emitted as an asset.
function blogIndexPlugin() {
  return {
    name: 'blog-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.includes(INDEX_PATH)) return next();
        const { json } = buildBlogIndex(blogsDir);
        res.setHeader('Content-Type', 'application/json');
        res.end(json);
      });
    },
    generateBundle() {
      const { json, count } = buildBlogIndex(blogsDir);
      this.emitFile({ type: 'asset', fileName: 'contents/blogs/blog-data.json', source: json });
      console.log(`[blog] indexed ${count} post(s)`);
    },
    closeBundle() {
      // Raw .md were copied from public/ but only the generated index is used
      // at runtime — strip them so the live site ships just blog-data.json.
      for (const entry of readdirSync(distBlogs)) {
        if (entry !== 'blog-data.json') rmSync(join(distBlogs, entry), { recursive: true, force: true });
      }
    },
  };
}

// base = deploy route. Default '/' (custom domain hgh.dev). Override per env,
// e.g. BASE_PATH=/portfolio/ for a github.io project page.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [blogIndexPlugin()],
  esbuild: {
    // Design components use classic JSX against a global React (see globals.js).
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});
