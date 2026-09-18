// Static prerenderer — runs after `vite build`.
//
// The app is a client-rendered SPA, so crawlers and social scrapers (which
// don't run JS) would otherwise see an empty shell with one shared <title>.
// This emits a real HTML file per route with a unique title/description/
// canonical/OG tags, JSON-LD, route chunk hints, and the actual React markup.
// The client hydrates this markup without replacing it with a second layout.
// It also writes sitemap.xml, robots.txt and the RSS feed.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { marked } from 'marked';
import { createServer } from 'vite';
import { buildBlogIndex } from './blog-index.mjs';
import { routes } from '../src/routes.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const contents = join(root, 'public', 'contents');
// SITE = canonical origin (sitemap/OG/canonical). BASE = route prefix, '' at root.
// Both env-overridable; keep in sync with vite's base (BASE_PATH).
const SITE = (process.env.SITE_URL || 'https://hgh.dev').replace(/\/+$/, '');
const BASE = (process.env.BASE_PATH || '/').replace(/\/+$/, '');

const readJSON = (p) => JSON.parse(readFileSync(join(contents, p), 'utf8'));
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const dateParts = (d) => /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
const isoDate = (d) => (dateParts(d) ? dateParts(d)[0] : '');
const rfc822 = (d) => {
  const m = dateParts(d);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toUTCString() : '';
};

const profile = readJSON('home/profile.json');
const resume = readJSON('home/resume.json');
const links = readJSON('links/links.json');
const posts = JSON.parse(buildBlogIndex(join(contents, 'blogs')).json);

// Identity meta that's the same on every page (author, avatar, social handles,
// JSON-LD) lives in the static index.html and would otherwise stay hardcoded.
// Rewrite it once from contents/ so the JSON files stay the single source.
const sameAs = [
  links.github && (links.github.url || `https://github.com/${links.github.username}`),
  links.gitlab && (links.gitlab.url || `https://gitlab.com/${links.gitlab.username}`),
  links.x && (links.x.url || `https://x.com/${links.x.handle}`),
  links.telegram && (links.telegram.url || `https://t.me/${links.telegram.handle}`),
  links.linkedin && (links.linkedin.url || `https://linkedin.com/in/${links.linkedin.handle}`),
].filter(Boolean);

/* ── structured data ── */

const abs = (path = '') => (path ? `${SITE}/${path}/` : `${SITE}/`);

// Employer / schools come straight from the resume so the Person entity search
// engines see matches the timeline the page renders.
const orgLd = (name) => (name ? { '@type': 'Organization', name } : undefined);
const firstItem = (type) => (resume.items || []).find((i) => i.type === type);

const personLd = {
  '@type': 'Person',
  '@id': `${SITE}/#person`,
  name: profile.name,
  alternateName: profile.handle,
  jobTitle: profile.title || undefined,
  description: profile.bio || undefined,
  url: abs(),
  image: profile.avatar,
  worksFor: orgLd(firstItem('work')?.company),
  alumniOf: orgLd(firstItem('education')?.school),
  sameAs,
};

// The Person is one entity across the whole site: spell it out once per graph
// and point at it by @id everywhere else, instead of repeating the full node.
const personRef = { '@id': personLd['@id'] };

const ldGraph = (...nodes) =>
  JSON.stringify(
    { '@context': 'https://schema.org', '@graph': [personLd, ...nodes.filter(Boolean)] },
    null,
    2,
  ).replace(/<\//g, '<\\/');

const pageNode = (type, meta, path) => ({
  '@type': type,
  name: meta.title,
  description: meta.desc,
  url: abs(path),
  inLanguage: 'en',
  about: personRef,
});

const breadcrumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    item: abs(path),
  })),
});

const postLd = (p) => ({
  '@type': 'BlogPosting',
  headline: p.title,
  description: p.description || p.title,
  url: abs(`blog/${p.slug}`),
  mainEntityOfPage: abs(`blog/${p.slug}`),
  datePublished: isoDate(p.date) || undefined,
  dateModified: isoDate(p.date) || undefined,
  inLanguage: 'en',
  image: profile.avatar,
  keywords: p.tags?.length ? p.tags.join(', ') : undefined,
  author: personRef,
  publisher: personRef,
  isPartOf: { '@type': 'Blog', name: `blog — ${profile.name}`, url: abs('blog') },
});

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

function assetLinks(page, extra = []) {
  const seen = new Set();
  const out = [];
  const linked = new Set([...template.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]));
  function add(rel, file) {
    const href = `${BASE}/${file}`;
    if (linked.has(href)) return;
    linked.add(href);
    out.push(`  <link rel="${rel}" crossorigin href="${href}" />`);
  }
  function visit(k) {
    if (!k || seen.has(k)) return;
    seen.add(k);
    const m = manifest[k];
    if (!m) return;
    if (m.file) add('modulepreload', m.file);
    for (const css of m.css || []) add('stylesheet', css);
    for (const dep of m.imports || []) visit(dep);
  }
  visit(pageEntries[page]);
  for (const k of extra) visit(k);
  return out.join('\n');
}

// Load the real components for static rendering without starting an HTTP server.
const server = await createServer({
  configFile: false,
  base: BASE || '/',
  server: { middlewareMode: true },
  appType: 'custom',
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
});
let render;
try {
  ({ render } = await server.ssrLoadModule('/src/entry-server.jsx'));
} finally {
  await server.close();
}

const template = readFileSync(join(dist, 'index.html'), 'utf8')
  .replace(/(<meta name="author" content=")[^"]*(")/, `$1${esc(profile.name)}$2`)
  .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(profile.avatar)}$2`)
  .replace(
    /(<meta name="twitter:creator" content=")[^"]*(")/,
    `$1@${esc(links.x?.handle || profile.handle)}$2`,
  );

/** Apply per-route <head> meta + inject body content into the shell. */
function page({
  title,
  desc,
  path,
  type = 'website',
  robots = false,
  jsonLd,
  extraHead = '',
  preload = '',
}) {
  // Trailing slash matches how GitHub Pages serves directory index.html files.
  const url = abs(path);
  const head = [
    `  <link rel="canonical" href="${url}" />`,
    `  <meta property="og:url" content="${url}" />`,
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${esc(desc)}" />`,
    `  <link rel="alternate" type="application/rss+xml" title="blog" href="${SITE}/feed.xml" />`,
    robots ? `  <meta name="robots" content="noindex" />` : '',
    preload,
    extraHead,
  ]
    .filter(Boolean)
    .join('\n');
  const data = { profile, resume, links };
  if (path === 'blog' || path?.startsWith('blog/')) data.blogIndex = posts;
  if (path?.startsWith('blog/')) {
    const post = posts.find((p) => `blog/${p.slug}` === path);
    if (post) data.postHtml = { [post.slug]: marked.parse(post.body) };
  }
  const content = robots ? '' : render(path || 'home', data);
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${type}$2`)
    .replace('</head>', `${head}\n</head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root">${content}</div><script id="portfolio-data" type="application/json">${serialized}</script>`,
    );
  if (jsonLd)
    html = html.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n${jsonLd}\n</script>`,
    );
  return html;
}

function write(path, html) {
  const dir = path ? join(dist, path) : dist;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

// Titles/descriptions come from the shared route registry (src/routes.js) so
// the prerendered <head> and the SPA never drift apart.
const ctx = { profile, links, resume };
const meta = Object.fromEntries(
  routes.map((r) => [r.page, { title: r.title(ctx), desc: r.description(ctx) }]),
);

/* ── emit ── */

const crumb = (page, label) =>
  breadcrumbs([
    ['home', ''],
    [label, page],
  ]);

write(
  '',
  page({
    ...meta.home,
    path: '',
    preload: assetLinks('home'),
    jsonLd: ldGraph({ ...pageNode('ProfilePage', meta.home, ''), mainEntity: personRef }),
  }),
);
write(
  'projects',
  page({
    ...meta.projects,
    path: 'projects',
    preload: assetLinks('projects'),
    jsonLd: ldGraph(
      pageNode('CollectionPage', meta.projects, 'projects'),
      crumb('projects', 'projects'),
    ),
  }),
);
write(
  'blog',
  page({
    ...meta.blog,
    path: 'blog',
    preload: assetLinks('blog'),
    jsonLd: ldGraph(
      {
        '@type': 'Blog',
        name: meta.blog.title,
        description: meta.blog.desc,
        url: abs('blog'),
        inLanguage: 'en',
        author: personRef,
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          headline: p.title,
          description: p.description || undefined,
          url: abs(`blog/${p.slug}`),
          datePublished: isoDate(p.date) || undefined,
          keywords: p.tags?.length ? p.tags.join(', ') : undefined,
          author: personRef,
        })),
      },
      crumb('blog', 'blog'),
    ),
  }),
);
write(
  'links',
  page({
    ...meta.links,
    path: 'links',
    preload: assetLinks('links'),
    jsonLd: ldGraph(pageNode('CollectionPage', meta.links, 'links'), crumb('links', 'links')),
  }),
);
write(
  'resume',
  page({
    ...meta.resume,
    path: 'resume',
    preload: assetLinks('resume'),
    jsonLd: ldGraph(pageNode('WebPage', meta.resume, 'resume'), crumb('resume', 'resume')),
  }),
);

for (const p of posts) {
  const path = `blog/${p.slug}`;
  write(
    path,
    page({
      title: `${p.title} — ${profile.name}`,
      desc: p.description || p.title,
      path,
      type: 'article',
      // The post body is re-rendered client-side from markdown, so its chunk is
      // needed right after boot — preload it alongside the blog chunk.
      preload: assetLinks('blog', ['src/lib/markdown.js']),
      extraHead: [
        isoDate(p.date)
          ? `  <meta property="article:published_time" content="${isoDate(p.date)}" />`
          : '',
        ...(p.tags || []).map((t) => `  <meta property="article:tag" content="${esc(t)}" />`),
      ]
        .filter(Boolean)
        .join('\n'),
      jsonLd: ldGraph(
        postLd(p),
        breadcrumbs([
          ['home', ''],
          ['blog', 'blog'],
          [p.title, path],
        ]),
      ),
    }),
  );
}

// SPA fallback for unknown deep links — boots the app, kept out of the index.
writeFileSync(join(dist, '404.html'), page({ ...meta.home, path: '', robots: true }));

// feed.xml — RSS 2.0 so readers and aggregators can follow the blog.
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(meta.blog.title)}</title>
    <link>${abs('blog')}</link>
    <description>${esc(meta.blog.desc)}</description>
    <language>en</language>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
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
      `  <url><loc>${SITE}/${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
  )
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

// robots.txt — keep its Sitemap line on the same origin as everything else.
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

// The manifest is a build artifact, not site content — drop it once read.
rmSync(join(dist, '.vite'), { recursive: true, force: true });

console.log(
  `[prerender] wrote ${routes.length + posts.length} pages + 404 + feed + sitemap (${entries.length} urls)`,
);
