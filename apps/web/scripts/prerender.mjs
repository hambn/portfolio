// Static prerenderer — runs after `vite build`.
//
// The app is a client-rendered SPA, so crawlers and social scrapers (which
// don't run JS) would otherwise see an empty shell with one shared <title>.
// This emits a real HTML file per route with a unique title/description/
// canonical/OG tags, JSON-LD, route chunk hints, and the actual React markup.
// The client hydrates this markup without replacing it with a second layout.
// It also writes sitemap.xml, robots.txt, the RSS feed, and the plain-text
// copies for agents (llms.txt, llms-full.txt, one .md per post).

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createServer } from 'vite';
import { buildBlogIndex } from './blog-index.mjs';
import { renderOgImage } from './og-image.mjs';
import { renderPost } from './render-post.mjs';
import './build-info.mjs';
import { routes } from '../src/routes.js';
import { buildLinkServices } from '../src/lib/linksDirectory.js';
import {
  INDEX_ROBOTS,
  isoDate,
  notFoundTitle,
  oembedPath,
  ogImagePath,
  pageGraph,
  projectListLd,
  routeMetadata,
} from '../src/lib/metadata.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const contents = fileURLToPath(new URL('../../../content', import.meta.url));
// Match `vite build`: same-origin `/api` served by the unified Cloudflare Worker / nginx.
process.env.VITE_API_BASE_URL ||= '/api';
// SITE = canonical origin (sitemap/OG/canonical). BASE = route prefix, '' at root.
// Both env-overridable; keep in sync with vite's base (BASE_PATH).
const SITE = (process.env.SITE_URL || 'https://hgh.dev').replace(/\/+$/, '');
// A path here would be doubled by BASE (…/portfolio/portfolio/) in every
// canonical, sitemap and feed URL; it belongs in BASE_PATH.
if (new URL(SITE).pathname !== '/')
  throw new Error(`SITE_URL must be an origin, e.g. https://hambn.github.io; got ${SITE}`);
const BASE = (process.env.BASE_PATH || '/').replace(/\/+$/, '');

// `_`-prefixed keys document the schema for whoever edits content/ by hand.
// They're notes to a human, so they're dropped before the payload is inlined
// into every prerendered page.
const readJSON = (p) =>
  JSON.parse(readFileSync(join(contents, p), 'utf8'), (key, value) =>
    key.startsWith('_') ? undefined : value,
  );
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
// A replacement given as a string is scanned for `$&`, `$1` and the like, so
// text from content/ ("costs $& more") would be rewritten on its way into the
// page. A function's return value is inserted exactly as it is.
const literal = (text) => () => text;
// Fills the attribute a pattern captures the two sides of: (open)…(close).
const between = (value) => (_, open, close) => `${open}${value}${close}`;
const dateParts = (d) => /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
const rfc822 = (d) => {
  const m = dateParts(d);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toUTCString() : '';
};

const profile = readJSON('home/profile.json');
const resume = readJSON('home/resume.json');
const links = readJSON('links/links.json');
const projects = readJSON('projects/projects.json');
const blog = buildBlogIndex(join(contents, 'blogs'));
const posts = JSON.parse(blog.json);
// What a page carries and the browser fetches: the posts without their
// Markdown, which only the build reads.
const postIndex = JSON.parse(blog.index);
const renderedPosts = new Map(posts.map((post) => [post.slug, renderPost(post.body)]));
const blogTags = [...new Set(posts.flatMap((post) => post.tags || []))];

// Identity meta that's the same on every page (author, avatar, social handles,
// JSON-LD) lives in the static index.html and would otherwise stay hardcoded.
// Rewrite it once from content/ so the JSON files stay the single source.
const sameAs = [
  links.github && (links.github.url || `https://github.com/${links.github.username}`),
  links.gitlab && (links.gitlab.url || `https://gitlab.com/${links.gitlab.username}`),
  links.x && (links.x.url || `https://x.com/${links.x.handle}`),
  links.telegram && (links.telegram.url || `https://t.me/${links.telegram.handle}`),
  links.linkedin && (links.linkedin.url || `https://linkedin.com/in/${links.linkedin.handle}`),
].filter(Boolean);

/* ── structured data ── */

const siteRoot = `${SITE}${BASE}`;
const abs = (path = '') => `${siteRoot}/${path ? `${path}/` : ''}`;

// Employer / schools come straight from the resume so the Person entity search
// engines see matches the timeline the page renders.
const orgLd = (name) => (name ? { '@type': 'Organization', name } : undefined);
const firstItem = (type) => (resume.items || []).find((i) => i.type === type);

const personLd = {
  '@type': 'Person',
  '@id': `${siteRoot}/#person`,
  name: profile.name,
  alternateName: profile.handle,
  jobTitle: profile.title || undefined,
  description: profile.bio || undefined,
  url: abs(),
  image: profile.avatar,
  worksFor: orgLd(firstItem('work')?.company),
  alumniOf: orgLd(firstItem('education')?.school),
  knowsAbout: resume.skills?.length ? resume.skills : undefined,
  sameAs,
};

/* ── lazy route chunks ──
 * Pages are dynamic imports, so the browser only discovers a route's chunk
 * after the app boots — one round-trip too late. Vite's build manifest maps
 * each page component to its built file; preload it (and its shared imports)
 * with the HTML instead. */
let manifest = {};
try {
  manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
} catch {
  // manifest: false in vite.config.js — pages still work, just without the hint.
}
const pageEntries = Object.fromEntries(
  (manifest['index.html']?.dynamicImports || [])
    .filter((k) => /^src\/pages\/[^/]+\/[A-Z]/.test(k))
    .map((k) => [/^src\/pages\/([^/]+)\//.exec(k)[1], k]),
);

// Stylesheets inlineStylesheet() has folded into the template as <style>.
const inlinedCss = new Set();

/* Vite's preload helper decides whether a chunk's stylesheet is already on the
 * page by looking for a <link rel="stylesheet"> with its URL. An inlined
 * <style> is invisible to it, so it would download the file again, and a lazy
 * route waits for that before rendering. A disabled link satisfies the lookup
 * without a request; it has to be created by script, because one written into
 * the HTML is still fetched by the preload scanner. */
function markInlined(hrefs) {
  if (!hrefs.length) return '';
  return `  <script>for(const h of ${JSON.stringify(hrefs)})document.head.appendChild(Object.assign(document.createElement('link'),{rel:'stylesheet',disabled:true,href:h}))</script>`;
}

/** Contents of a built asset addressed by its public href, or null if missing. */
function readAsset(href) {
  try {
    return readFileSync(join(dist, href.replace(BASE, '').replace(/^\//, '')), 'utf8');
  } catch {
    return null;
  }
}

function assetLinks(page) {
  const seen = new Set();
  const out = [];
  const inlined = [];
  const linked = new Set([
    ...inlinedCss,
    ...[...template.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]),
  ]);
  function add(rel, file) {
    const href = `${BASE}/${file}`;
    if (linked.has(href)) return;
    linked.add(href);
    out.push(`  <link rel="${rel}" crossorigin href="${href}" />`);
  }
  // A route's own stylesheet blocks the first paint exactly like the entry one
  // does, and it is only a few KB, so fold it in too. Linking is kept as the
  // fallback for a file the manifest names but the build didn't emit.
  function addStyle(file) {
    const href = `${BASE}/${file}`;
    if (linked.has(href)) return;
    linked.add(href);
    const css = readAsset(href);
    if (css !== null) inlined.push(href);
    out.push(
      css === null
        ? `  <link rel="stylesheet" crossorigin href="${href}" />`
        : `  <style>${css}</style>`,
    );
  }
  function visit(k) {
    if (!k || seen.has(k)) return;
    seen.add(k);
    const m = manifest[k];
    if (!m) return;
    if (m.file) add('modulepreload', m.file);
    for (const css of m.css || []) addStyle(css);
    for (const dep of m.imports || []) visit(dep);
  }
  visit(pageEntries[page]);
  out.push(markInlined(inlined));
  return out.filter(Boolean).join('\n');
}

// Load the real components for static rendering without starting an HTTP server.
const server = await createServer({
  root,
  configFile: false,
  base: BASE || '/',
  server: { middlewareMode: true },
  appType: 'custom',
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
});
let render;
let featuredProjects;
let avatarImage;
let API_BASE;
try {
  ({ render, featuredProjects } = await server.ssrLoadModule('/src/entry-server.jsx'));
  ({ avatarImage, API_BASE } = await server.ssrLoadModule('/src/lib/api.js'));
} finally {
  await server.close();
}

/* ── critical CSS ──
 * The app's one stylesheet is small but render-blocking: the browser can't
 * find it until the HTML arrives, and can't paint until it lands. Inlining it
 * collapses that round-trip out of the critical path. Client-side navigation
 * reuses the same document, so no route pays for it twice. */
function inlineStylesheet(html) {
  return html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (tag, href) => {
    const css = readAsset(href);
    if (css === null) return tag; // Leave the link in place if the file moved.
    // Remember it: assetLinks() walks the manifest and would otherwise link
    // this same file again as a route dependency.
    inlinedCss.add(href);
    return `<style>${css}</style>\n${markInlined([href]).trimStart()}`;
  });
}

/* ── early head preloads ──
 * Pull Vite's modulepreload hints (react, entry, shared runtime) up to the top
 * of <head>, right next to the font preload and BEFORE the 13–70 KB of inlined
 * critical CSS, so the browser discovers them in the first 14 KB TCP packet. */
function hoistPreloads(html) {
  const tags = [];
  const stripped = html.replace(/<link\s+rel="modulepreload"[^>]*>/g, (tag) => {
    tags.push(tag.trim());
    return '';
  });
  const src = /<script type="module"[^>]*src="([^"]+)"/.exec(stripped)?.[1];
  if (src && !tags.some((t) => t.includes(`href="${src}"`))) {
    tags.unshift(`<link rel="modulepreload" crossorigin href="${src}" />`);
  }
  const externalApi = /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : '';
  if (externalApi && externalApi !== SITE) {
    tags.unshift(`<link rel="preconnect" href="${esc(externalApi)}" crossorigin />`);
  }
  if (!tags.length) return stripped;
  return stripped.replace(
    /(<meta name="viewport"[^>]*>)/,
    (viewport) => `${viewport}\n    ${tags.join('\n    ')}`,
  );
}

/* ── body font ──
 * Preloading the upright latin JetBrains Mono woff2 starts the download in the
 * first TCP packet alongside the entry/react scripts. Paired with `font-display:
 * swap` and the metric-matched fallback in styles/fonts.css, fast visits paint
 * directly in JetBrains Mono and slow links never block text paint. */
function preloadFont(html) {
  const href = /url\(([^)]*jetbrains-mono-latin-wght-normal[^)]*\.woff2)\)/.exec(html)?.[1];
  if (!href) return html;
  return html.replace(
    /(<meta name="viewport"[^>]*>)/,
    (viewport) =>
      `${viewport}\n    <link rel="preload" as="font" type="font/woff2" crossorigin href="${href.replace(/['"]/g, '')}" />`,
  );
}

const template = preloadFont(
  hoistPreloads(inlineStylesheet(readFileSync(join(dist, 'index.html'), 'utf8'))),
)
  .replace(/(<meta\s+name="author"\s+content=")[^"]*(")/, between(esc(profile.name)))
  .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, between(esc(profile.avatar)))
  // The tab icon is drawn at 32px at most, so ask the proxy for a small
  // rendition rather than the full-size image the og: tags advertise: the one
  // home's avatar already loads at 1x (AVATAR_SIZE in pages/home/Intro.jsx),
  // so there the icon costs no second download.
  .replace(
    /(<link\s+rel="icon"[^>]*\shref=")[^"]*(")/,
    between(esc(avatarImage(profile.avatar, 72).src)),
  )
  .replace(
    /(<meta\s+name="twitter:creator"\s+content=")[^"]*(")/,
    between(`@${esc(links.x?.handle || profile.handle)}`),
  );

/* ── Content-Security-Policy ──
 * GitHub Pages sends no headers of its own, so the policy ships as a <meta> in
 * each page. Scripts run only from this origin, plus the few inline ones the
 * page carries, each allowed by the hash of its exact text: markup that gets
 * injected some other way (a post, an API answer) cannot run a script, load a
 * plugin or repoint relative URLs. Styles stay open to inline use, which React
 * style props, the inlined critical CSS and Mermaid all need.
 *
 * The API answers from another origin and cards load art from the providers'
 * own hosts, so images, media and fetches are held to https rather than to a
 * list; a plain-http API base (local development) is named explicitly. */
const apiOrigin = /^http:/.test(API_BASE) ? new URL(API_BASE).origin : '';
const apiSocket = apiOrigin.replace(/^http/, 'ws');
const INLINE_SCRIPT = /<script(?![^>]*\s(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g;

function withCsp(html) {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
    (match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`,
  );
  const policy = [
    `default-src 'self'`,
    `script-src 'self' ${[...new Set(hashes)].join(' ')}`.trimEnd(),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https: ${apiOrigin}`.trimEnd(),
    `media-src 'self' https: ${apiOrigin}`.trimEnd(),
    `font-src 'self' data:`,
    `connect-src 'self' https: wss: ${apiOrigin} ${apiSocket}`.trimEnd(),
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');
  // Ahead of every script the page carries: a policy only governs what the
  // parser meets after it.
  return html.replace(
    /(<meta\s+name="viewport"[^>]*>)/,
    (viewport) =>
      `${viewport}\n    <meta http-equiv="Content-Security-Policy" content="${esc(policy)}" />`,
  );
}

/** Apply per-route <head> meta + inject body content into the shell. */
function page({
  title,
  desc,
  path,
  type = 'website',
  notFound = false,
  ogImage = `${siteRoot}/og/home.png`,
  ogAlt = title,
  oembedUrl = '',
  jsonLd,
  extraHead = '',
  preload = '',
}) {
  // Trailing slash matches how GitHub Pages serves directory index.html files.
  const url = abs(path);
  const data = { profile };
  // The not-found page shares home's path but renders none of its content.
  const home = !path && !notFound;
  if (home || path === 'resume') data.resume = resume;
  // Home lists the newest posts and cross-links skills that match blog tags.
  if (home) {
    data.recentPosts = posts.slice(0, 3).map(({ slug, title, date }) => ({ slug, title, date }));
    data.blogTags = blogTags;
  }
  if (['projects', 'links', 'resume'].includes(path)) data.links = links;
  if (path === 'projects') data.projects = projects;
  if (path === 'blog' || path?.startsWith('blog/')) data.blogIndex = postIndex;
  if (path?.startsWith('blog/')) {
    const post = posts.find((p) => `blog/${p.slug}` === path);
    if (post) data.postHtml = { [post.slug]: renderedPosts.get(post.slug) };
  }
  let content = notFound ? '' : render(path || 'home', data);
  // Hoist any `<link rel="preload" as="image" ...>` emitted by React SSR out
  // of #root into the top of <head> so the LCP avatar starts in packet #1.
  const hoistedImages = [];
  content = content.replace(/<link\s+rel="preload"\s+as="image"[^>]*\/?>/g, (tag) => {
    hoistedImages.push(
      tag.replace(/\bimageSrcSet=/g, 'imagesrcset=').replace(/\bfetchPriority=/g, 'fetchpriority='),
    );
    return '';
  });
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');

  // Split route modulepreloads (early in <head>) from route inline styles.
  const routeModulePreloads = [];
  const routeRest = preload
    .split('\n')
    .filter((line) => {
      if (line.includes('rel="modulepreload"')) {
        routeModulePreloads.push(line.trim());
        return false;
      }
      return Boolean(line);
    })
    .join('\n');
  const earlyHints = [...hoistedImages, ...routeModulePreloads];

  // No image preload here on purpose: React already emits one for the home
  // avatar because it renders with fetchPriority="high". A second link for the
  // same URL would only duplicate markup.
  const head = [
    // A not-found page names no canonical URL: it is no page's duplicate.
    notFound ? '' : `  <link rel="canonical" href="${esc(url)}" />`,
    notFound ? '' : `  <meta property="og:url" content="${esc(url)}" />`,
    `  <meta property="og:site_name" content="${esc(profile.name)}" />`,
    `  <meta property="og:locale" content="en_US" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:type" content="image/png" />`,
    `  <meta property="og:image:alt" content="${esc(ogAlt)}" />`,
    `  <meta name="twitter:image" content="${esc(ogImage)}" />`,
    `  <meta name="twitter:image:alt" content="${esc(ogAlt)}" />`,
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${esc(desc)}" />`,
    `  <link rel="alternate" type="application/rss+xml" title="${esc(profile.name)} — blog" href="${siteRoot}/feed.xml" />`,
    `  <link rel="alternate" type="application/feed+json" title="${esc(profile.name)} — blog" href="${siteRoot}/feed.json" />`,
    oembedUrl
      ? `  <link rel="alternate" type="application/json+oembed" title="${esc(title)}" href="${esc(oembedUrl)}" />`
      : '',
    `  <meta name="robots" content="${notFound ? 'noindex' : INDEX_ROBOTS}" />`,
    routeRest,
    extraHead,
  ]
    .filter(Boolean)
    .join('\n');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, literal(`<title>${esc(title)}</title>`))
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, between(esc(desc)))
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, between(esc(title)))
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, between(esc(desc)))
    .replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/, between(type))
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, between(esc(ogImage)))
    .replace('</head>', literal(`${head}\n</head>`))
    .replace(
      '<div id="root"></div>',
      literal(
        `<div id="root">${content}</div><script id="portfolio-data" type="application/json">${serialized}</script>`,
      ),
    );
  if (earlyHints.length) {
    html = html.replace(
      /(<meta name="viewport"[^>]*>)/,
      (viewport) => `${viewport}\n    ${earlyHints.join('\n    ')}`,
    );
  }
  // The template's structured data is a placeholder: every page replaces it,
  // and a not-found page, which describes nothing, drops it.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    literal(jsonLd ? `<script type="application/ld+json">\n${jsonLd}\n</script>` : ''),
  );
  return withCsp(html);
}

function write(path, html) {
  const dir = path ? join(dist, path) : dist;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

// Every post is also published as the Markdown it was written in, for readers
// that want the text without the page around it (agents, LLMs, feed tools).
const postMarkdownUrl = (post) => `${siteRoot}/blog/${post.slug}.md`;

// Titles/descriptions come from the shared route registry (src/routes.js) so
// the prerendered <head> and the SPA never drift apart.
const ctx = { profile, links, resume };
// The featured cards as content alone describes them: what a crawler reads.
const featured = featuredProjects(projects);
const meta = Object.fromEntries(
  routes.map((r) => [r.page, { title: r.title(ctx), desc: r.description(ctx) }]),
);

const ogHost = new URL(SITE).host;
const ogDir = join(dist, 'og');
const oembedDir = join(dist, 'oembed');
mkdirSync(ogDir, { recursive: true });
mkdirSync(oembedDir, { recursive: true });
const ogTasks = [];
const projectLanguages = [...new Set(featured.map((p) => p.language).filter(Boolean))].slice(0, 3);
const linkServices = buildLinkServices(links, profile);

function writeOembed(relPath, { title, ogUrl, provider = ogHost }) {
  const payload = {
    version: '1.0',
    type: 'link',
    author_name: profile.name,
    author_url: abs(),
    provider_name: provider,
    provider_url: abs(),
    title,
    thumbnail_url: ogUrl,
    thumbnail_width: 1200,
    thumbnail_height: 630,
  };
  writeFileSync(join(dist, relPath), `${JSON.stringify(payload, null, 2)}\n`);
}

function minimalRedirectFallback(service) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0;url=${esc(service.url)}" />
    <title>${esc(service.label)}</title>
    <script>window.location.replace(${JSON.stringify(service.url)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${esc(service.url)}" rel="noopener noreferrer">${esc(service.url)}</a>…</p>
  </body>
</html>
`;
  return withCsp(html);
}

function linkContactPage(service, ogUrl, oembedUrl) {
  const shareUrl = abs(`links/${service.slug}`);
  const title = `${service.label} — ${profile.name}`;
  const cardTitle = `${service.label} — ${service.handle}`;
  const linksIndexUrl = `${BASE}/links/`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <link rel="icon" type="image/png" href="${esc(avatarImage(profile.avatar, 72).src)}" />
    <link rel="canonical" href="${esc(shareUrl)}" />
    <meta name="description" content="${esc(service.tagline)}" />
    <meta name="author" content="${esc(profile.name)}" />
    <meta name="robots" content="noindex, follow" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="theme-color" content="#3b82f6" />
    <meta property="og:site_name" content="${esc(ogHost)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="${esc(shareUrl)}" />
    <meta property="og:title" content="${esc(cardTitle)}" />
    <meta property="og:description" content="${esc(service.tagline)}" />
    <meta property="og:image" content="${esc(ogUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:alt" content="${esc(cardTitle)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:creator" content="@${esc(links.x?.handle || profile.handle)}" />
    <meta name="twitter:title" content="${esc(cardTitle)}" />
    <meta name="twitter:description" content="${esc(service.tagline)}" />
    <meta name="twitter:image" content="${esc(ogUrl)}" />
    <meta name="twitter:image:alt" content="${esc(cardTitle)}" />
    <link rel="alternate" type="application/json+oembed" title="${esc(cardTitle)}" href="${esc(oembedUrl)}" />
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{min-height:100vh;display:grid;place-items:center;padding:24px;background:#09090b;color:#fafafa;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
      main{width:min(520px,100%);border:1px solid #27272a;border-top:3px solid #3b82f6;border-radius:14px;background:#111114;padding:28px}
      .path{color:#93939d;font-size:13px;margin-bottom:14px}
      .path b{color:#3b82f6}
      h1{font-size:20px;font-weight:700;margin-bottom:8px}
      p{color:#b4b4bd;font-size:14px;line-height:1.6;margin-bottom:20px}
      .actions{display:flex;flex-wrap:wrap;gap:10px}
      a{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none}
      .primary{background:#2563eb;color:#fff;font-weight:600}
      .secondary{border:1px solid #27272a;color:#b4b4bd}
    </style>
  </head>
  <body>
    <main>
      <div class="path"><b>${esc(ogHost)}</b>/links/${esc(service.slug)}</div>
      <h1>${esc(cardTitle)}</h1>
      <p>${esc(service.tagline)}</p>
      <div class="actions">
        <a class="primary" href="${esc(service.url)}" rel="noopener noreferrer">Email ${esc(service.handle)}</a>
        <a class="secondary" href="${esc(linksIndexUrl)}">All links</a>
      </div>
    </main>
  </body>
</html>
`;
  return withCsp(html);
}

function ogCardMeta(metadata) {
  if (metadata.post) {
    const readMeta = [
      isoDate(metadata.post.date),
      metadata.post.minutes ? `${metadata.post.minutes} min read` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      path: 'blog',
      title: metadata.post.title,
      description: metadata.post.description,
      kicker: readMeta,
      meta: (metadata.post.tags || []).slice(0, 3),
    };
  }
  switch (metadata.page) {
    case 'home':
      return {
        path: '',
        title: profile.name,
        description: profile.bio,
        kicker: profile.title || 'devops engineer',
        meta: (resume.skills || []).slice(0, 3),
      };
    case 'projects':
      return {
        path: 'projects',
        title: 'Projects',
        description: metadata.desc,
        kicker: `${featured.length} featured`,
        meta: projectLanguages.length ? projectLanguages : ['github', 'gitlab', 'codeberg'],
      };
    case 'blog':
      return {
        path: 'blog',
        title: 'Blog',
        description: metadata.desc,
        kicker: `${posts.length} posts`,
        meta: blogTags.slice(0, 3),
      };
    case 'links':
      return {
        path: 'links',
        title: 'Links & Contact',
        description: metadata.desc,
        kicker: `${linkServices.length} profiles`,
        meta: ['github', 'discord', 'telegram'],
      };
    case 'resume':
      return {
        path: 'resume',
        title: 'Resume',
        description: metadata.desc,
        kicker: firstItem('work')?.role || profile.title || '',
        meta: (resume.skills || []).slice(0, 3),
      };
    default:
      return { path: metadata.path, title: metadata.title, description: metadata.desc, meta: [] };
  }
}

for (const route of [
  ...routes.map((entry) => entry.page),
  ...posts.map((post) => `blog/${post.slug}`),
]) {
  const metadata = routeMetadata(route, profile, posts);
  const ogRel = ogImagePath(metadata);
  const oembedRel = oembedPath(metadata);
  const ogUrl = `${siteRoot}/${ogRel}`;
  const oembedUrl = `${siteRoot}/${oembedRel}`;
  ogTasks.push({
    file: join(dist, ogRel),
    opts: {
      ...ogCardMeta(metadata),
      host: ogHost,
      handle: profile.handle,
      author: profile.name,
    },
  });
  writeOembed(oembedRel, { title: metadata.title, ogUrl });
  write(
    metadata.path,
    page({
      ...metadata,
      ogImage: ogUrl,
      ogAlt: metadata.title,
      oembedUrl,
      preload: assetLinks(metadata.page),
      extraHead: metadata.post
        ? [
            isoDate(metadata.post.date)
              ? `  <meta property="article:published_time" content="${isoDate(metadata.post.date)}" />`
              : '',
            `  <meta property="article:author" content="${esc(profile.name)}" />`,
            ...metadata.post.tags.map(
              (tag) => `  <meta property="article:tag" content="${esc(tag)}" />`,
            ),
            `  <link rel="alternate" type="text/markdown" href="${esc(postMarkdownUrl(metadata.post))}" />`,
          ]
            .filter(Boolean)
            .join('\n')
        : '',
      jsonLd: JSON.stringify(
        pageGraph(
          metadata,
          personLd,
          siteRoot,
          posts,
          metadata.page === 'projects' ? projectListLd(featured) : undefined,
        ),
      ).replace(/</g, '\\u003c'),
    }),
  );
}

// External `/links/<service>/` paths issue real HTTP 302 redirects via
// Cloudflare's `_redirects` file (0 Worker invocations), so chat unfurlers
// follow through and render each destination website's own native embed.
const redirectRules = [
  '# External link short-URLs — HTTP 302 so unfurlers fetch the destination site embed.',
];
for (const service of linkServices) {
  if (service.redirect) {
    const basePath = `${BASE}/links/${service.slug}`;
    redirectRules.push(`${basePath} ${service.url} 302`);
    redirectRules.push(`${basePath}/ ${service.url} 302`);
    // Minimal HTML fallback for static hosts that do not process `_redirects`.
    write(`links/${service.slug}`, minimalRedirectFallback(service));
  } else {
    const ogRel = `og/links-${service.slug}.png`;
    const oembedRel = `oembed/links-${service.slug}.json`;
    const ogUrl = `${siteRoot}/${ogRel}`;
    const oembedUrl = `${siteRoot}/${oembedRel}`;
    ogTasks.push({
      file: join(dist, ogRel),
      opts: {
        path: `links/${service.slug}`,
        title: `${service.label} — ${service.handle}`,
        description: service.tagline,
        kicker: 'contact',
        meta: [service.handle],
        host: ogHost,
        handle: profile.handle,
        author: profile.name,
      },
    });
    writeOembed(oembedRel, { title: `${service.label} — ${service.handle}`, ogUrl });
    write(`links/${service.slug}`, linkContactPage(service, ogUrl, oembedUrl));
  }
}
writeFileSync(join(dist, '_redirects'), `${redirectRules.join('\n')}\n`);

await Promise.all(
  ogTasks.map(async ({ file, opts }) => writeFileSync(file, await renderOgImage(opts))),
);

// SPA fallback for unknown deep links — boots the app, kept out of the index.
writeFileSync(
  join(dist, '404.html'),
  page({ ...meta.home, title: notFoundTitle(profile), path: '', notFound: true }),
);

// feed.xml — RSS 2.0 so readers and aggregators can follow the blog.
const lastBuildDate = rfc822(posts[0]?.date);
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(meta.blog.title)}</title>
    <link>${abs('blog')}</link>
    <description>${esc(meta.blog.desc)}</description>
    <language>en</language>
${lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` : ''}    <atom:link href="${siteRoot}/feed.xml" rel="self" type="application/rss+xml" />
${posts
  .map((p) => {
    const url = abs(`blog/${p.slug}`);
    return [
      '    <item>',
      `      <title>${esc(p.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      rfc822(p.date) ? `      <pubDate>${rfc822(p.date)}</pubDate>` : '',
      p.description ? `      <description>${esc(p.description)}</description>` : '',
      ...(p.tags || []).map((t) => `      <category>${esc(t)}</category>`),
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n');
  })
  .join('\n')}
  </channel>
</rss>
`;
writeFileSync(join(dist, 'feed.xml'), feed);

// feed.json — JSON Feed 1.1 for modern feed readers and tools.
const jsonFeed = {
  version: 'https://jsonfeed.org/version/1.1',
  title: meta.blog.title,
  home_page_url: abs('blog'),
  feed_url: `${siteRoot}/feed.json`,
  description: meta.blog.desc,
  language: 'en',
  icon: profile.avatar,
  authors: [{ name: profile.name, url: abs(), avatar: profile.avatar }],
  items: posts.map((p) => {
    const url = abs(`blog/${p.slug}`);
    const published = isoDate(p.date);
    return {
      id: url,
      url,
      title: p.title,
      ...(p.description ? { summary: p.description } : {}),
      content_html: renderedPosts.get(p.slug),
      image: `${siteRoot}/og/blog-${p.slug}.png`,
      ...(published ? { date_published: `${published}T00:00:00Z` } : {}),
      ...(p.tags?.length ? { tags: p.tags } : {}),
    };
  }),
};
writeFileSync(join(dist, 'feed.json'), `${JSON.stringify(jsonFeed, null, 2)}\n`);

// sitemap.xml — every indexable URL, matching the trailing-slash form served.
// lastmod is only emitted where there's a real content date (posts + blog index).
const entries = routes
  .map((r) => ({
    loc: r.path ? `${r.path}/` : '',
    lastmod: r.page === 'blog' ? isoDate(posts[0]?.date) : '',
  }))
  .concat(posts.map((p) => ({ loc: `blog/${p.slug}/`, lastmod: isoDate(p.date) })));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
  .map(
    ({ loc, lastmod }) =>
      `  <url><loc>${esc(`${siteRoot}/${loc}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

/* ── plain-text copies for agents ──
 * llms.txt is the index an LLM or agent reads first (llmstxt.org): what the
 * site is and where each thing lives. llms-full.txt is the whole site as one
 * Markdown document, and each post is published as its own .md file. All of it
 * comes from content/, like the pages. */
const postMarkdown = (post) =>
  [
    `# ${post.title}`,
    '',
    [isoDate(post.date), (post.tags || []).join(', ')].filter(Boolean).join(' · '),
    post.description ? `\n> ${post.description}\n` : '',
    post.body.trim(),
    '',
  ].join('\n');
for (const post of posts) writeFileSync(join(dist, 'blog', `${post.slug}.md`), postMarkdown(post));

const oneLine = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const bullet = (label, url, note) =>
  `- [${oneLine(label)}](${url})${note ? `: ${oneLine(note)}` : ''}`;
const projectLines = featured.map((project) =>
  bullet(project.name, project.repo || project.homepage || abs('projects'), project.description),
);
const llms = [
  `# ${profile.name}`,
  '',
  `> ${oneLine(profile.bio)}`,
  '',
  oneLine(
    `Personal site of ${profile.name}${profile.handle ? ` (${profile.handle})` : ''}${profile.title ? `, ${profile.title}` : ''}. Everything here may be read, quoted and linked.`,
  ),
  '',
  '## Pages',
  '',
  ...routes.map((route) => bullet(meta[route.page].title, abs(route.path), meta[route.page].desc)),
  ...(posts.length
    ? [
        '',
        '## Blog posts',
        '',
        ...posts.map((post) => bullet(post.title, postMarkdownUrl(post), post.description)),
      ]
    : []),
  ...(projectLines.length ? ['', '## Projects', '', ...projectLines] : []),
  ...(sameAs.length
    ? ['', '## Elsewhere', '', ...sameAs.map((url) => bullet(new URL(url).hostname, url))]
    : []),
  '',
  '## Optional',
  '',
  bullet('Full text', `${siteRoot}/llms-full.txt`, 'this index plus the resume and every post'),
  bullet('RSS feed', `${siteRoot}/feed.xml`),
  bullet('JSON feed', `${siteRoot}/feed.json`),
  bullet('Sitemap', `${siteRoot}/sitemap.xml`),
  '',
].join('\n');
writeFileSync(join(dist, 'llms.txt'), llms);

const resumeLines = (resume.items || []).flatMap((item) => [
  `### ${oneLine([item.role || item.degree || item.title, item.company || item.school].filter(Boolean).join(', '))}`,
  '',
  oneLine(
    [[item.start, item.end].filter(Boolean).join(' – '), item.employment, item.location]
      .filter(Boolean)
      .join(' · '),
  ),
  '',
  ...(Array.isArray(item.description) ? item.description : [item.description])
    .filter(Boolean)
    .map((line) => `- ${oneLine(line)}`),
  '',
]);
writeFileSync(
  join(dist, 'llms-full.txt'),
  [
    llms,
    ...(resumeLines.length ? ['## Resume', '', ...resumeLines] : []),
    ...(resume.skills?.length ? [`Skills: ${resume.skills.join(', ')}`, ''] : []),
    ...posts.flatMap((post) => [
      '---',
      '',
      postMarkdown(post),
      `Source: ${abs(`blog/${post.slug}`)}`,
      '',
    ]),
  ].join('\n'),
);

// robots.txt — everything is open to every crawler. The AI crawlers and
// assistants are named as well: several of them only treat a site as opted in
// when their own token appears, and it documents the intent for the rest.
// The Sitemap line stays on the same origin as everything else.
const AI_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'Amazonbot',
  'DuckAssistBot',
  'MistralAI-User',
  'CCBot',
];
writeFileSync(
  join(dist, 'robots.txt'),
  [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI crawlers and assistants are welcome. A plain-text index of the site',
    `# for them is at ${siteRoot}/llms.txt`,
    ...AI_AGENTS.map((agent) => `User-agent: ${agent}`),
    'Allow: /',
    '',
    `Sitemap: ${siteRoot}/sitemap.xml`,
    '',
  ].join('\n'),
);

// The manifest is a build artifact, not site content — drop it once read.
rmSync(join(dist, '.vite'), { recursive: true, force: true });

console.log(
  `[prerender] wrote ${routes.length + posts.length} pages + ${linkServices.length} link embeds + ${ogTasks.length} og cards + 404 + feeds + sitemap (${entries.length} urls)`,
);
