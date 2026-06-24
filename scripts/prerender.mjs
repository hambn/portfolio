// Static prerenderer — runs after `vite build`.
//
// The app is a client-rendered SPA, so crawlers and social scrapers (which
// don't run JS) would otherwise see an empty shell with one shared <title>.
// This emits a real HTML file per route with a unique title/description/
// canonical/OG tags AND the actual content (home, blog list, every post,
// links, resume) baked in. The SPA still boots and takes over for users.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { marked } from 'marked';
import { buildBlogIndex } from './blog-index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const contents = join(root, 'public', 'contents');
const SITE = 'https://hambn.github.io/portfolio';
const BASE = '/portfolio';

const readJSON = (p) => JSON.parse(readFileSync(join(contents, p), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return d || '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
};

const profile = readJSON('home/profile.json');
const resume = readJSON('home/resume.json');
const links = readJSON('links/links.json');
const posts = JSON.parse(buildBlogIndex(join(contents, 'blogs')).json);

const template = readFileSync(join(dist, 'index.html'), 'utf8');

/** Apply per-route <head> meta + inject body content into the shell. */
function page({ title, desc, path, type = 'website', content, robots = false }) {
  // Trailing slash matches how GitHub Pages serves directory index.html files.
  const url = path ? `${SITE}/${path}/` : `${SITE}/`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${type}$2`)
    .replace(
      '</head>',
      `  <link rel="canonical" href="${url}" />\n` +
      `  <meta property="og:url" content="${url}" />\n` +
      `  <meta name="twitter:title" content="${esc(title)}" />\n` +
      `  <meta name="twitter:description" content="${esc(desc)}" />\n` +
      (robots ? `  <meta name="robots" content="noindex" />\n` : '') +
      `</head>`
    )
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  return html;
}

function write(path, html) {
  const dir = path ? join(dist, path) : dist;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;

/* ── content blocks (semantic, text-first; SPA restyles for users) ── */

const resumeEntry = (it) => {
  const desc = Array.isArray(it.description) ? `<ul>${it.description.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '';
  return `<div><h3>${esc(it.role || it.degree)}</h3><p>${esc(it.company || it.school)}${it.location ? ' · ' + esc(it.location) : ''} · ${esc(it.start)}–${esc(it.end)}</p>${desc}</div>`;
};

const homeContent = `
<main>
  <img src="${esc(profile.avatar)}" alt="${esc(profile.name)}" width="72" height="72" />
  <h1>${esc(profile.name)}</h1>
  <p>@${esc(profile.handle)}</p>
  <p>${esc(profile.bio)}</p>
  <nav>${link(BASE + '/projects', 'projects')} ${link(BASE + '/blog', 'blog')} ${link(BASE + '/links', 'links')} ${link(BASE + '/resume', 'resume')}</nav>
  <section><h2>work &amp; education</h2>${(resume.items || []).map(resumeEntry).join('')}</section>
</main>`;

const blogListContent = `
<main>
  <h1>blog</h1>
  <p>notes on infra, tooling, and things i figure out</p>
  <ul>${posts.map((p) => `<li>${link(`${BASE}/blog/${p.slug}`, p.title)}${p.description ? ' — ' + esc(p.description) : ''} <time datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time></li>`).join('')}</ul>
</main>`;

const postContent = (p) => `
<main><article>
  <p><time datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time></p>
  <h1>${esc(p.title)}</h1>
  ${p.tags?.length ? `<p>${p.tags.map((t) => `<span>${esc(t)}</span>`).join(' ')}</p>` : ''}
  <div class="markdown-body">${marked.parse(p.body)}</div>
</article></main>`;

const linkRows = () => {
  const rows = [];
  if (links.email?.address) rows.push(['email', `mailto:${links.email.address}`]);
  if (links.discord?.userId) rows.push(['discord', `https://discord.com/users/${links.discord.userId}`]);
  if (links.telegram) rows.push(['telegram', links.telegram.url || `https://t.me/${links.telegram.handle}`]);
  if (links.x) rows.push(['x', links.x.url || `https://x.com/${links.x.handle}`]);
  if (links.github) rows.push(['github', links.github.url || `https://github.com/${links.github.username}`]);
  if (links.gitlab) rows.push(['gitlab', links.gitlab.url || `https://gitlab.com/${links.gitlab.username}`]);
  if (links.linkedin) rows.push(['linkedin', links.linkedin.url || `https://linkedin.com/in/${links.linkedin.handle}`]);
  if (links.spotify?.userId) rows.push(['spotify', `https://open.spotify.com/user/${links.spotify.userId}`]);
  if (links.steam) rows.push(['steam', links.steam.url || `https://steamcommunity.com/id/${links.steam.handle}`]);
  return rows;
};

const linksContent = `
<main>
  <h1>links</h1>
  <p>find me around the web</p>
  <ul>${linkRows().map(([label, href]) => `<li>${link(href, label)}</li>`).join('')}</ul>
</main>`;

const work = (resume.items || []).filter((i) => i.type === 'work');
const edu = (resume.items || []).filter((i) => i.type === 'education');
const resumeContent = `
<main>
  <h1>${esc(profile.name)} — resume</h1>
  <p>${esc(profile.title || '')}</p>
  ${work.length ? `<section><h2>experience</h2>${work.map(resumeEntry).join('')}</section>` : ''}
  ${edu.length ? `<section><h2>education</h2>${edu.map(resumeEntry).join('')}</section>` : ''}
  ${resume.skills?.length ? `<section><h2>skills</h2><p>${resume.skills.map(esc).join(', ')}</p></section>` : ''}
</main>`;

/* ── emit ── */

const name = profile.name;
write('', page({ title: `${name} — ${profile.title || 'portfolio'}`, desc: profile.bio, path: '', content: homeContent }));
write('projects', page({ title: `projects — ${name}`, desc: `open-source projects and public repositories by ${name}.`, path: 'projects', content: `<main><h1>projects</h1><p>public repositories on github — ${link(links.github?.url || 'https://github.com/' + (links.github?.username || 'hambn'), 'view on github')}</p></main>` }));
write('blog', page({ title: `blog — ${name}`, desc: 'notes on infra, tooling, and things i figure out.', path: 'blog', content: blogListContent }));
write('links', page({ title: `links — ${name}`, desc: 'find me around the web — github, gitlab, linkedin, and more.', path: 'links', content: linksContent }));
write('resume', page({ title: `resume — ${name}`, desc: `${name} — ${profile.title || ''}. experience, education and skills.`, path: 'resume', content: resumeContent }));

for (const p of posts) {
  write(`blog/${p.slug}`, page({
    title: `${p.title} — ${name}`,
    desc: p.description || p.title,
    path: `blog/${p.slug}`,
    type: 'article',
    content: postContent(p),
  }));
}

// SPA fallback for unknown deep links — boots the app, kept out of the index.
writeFileSync(join(dist, '404.html'), page({ title: `${name} — ${profile.title || 'portfolio'}`, desc: profile.bio, path: '', content: '', robots: true }));

// sitemap.xml — every indexable URL, matching the trailing-slash form served.
const urls = ['', 'projects/', 'blog/', 'links/', 'resume/', ...posts.map((p) => `blog/${p.slug}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map((u) => `  <url><loc>${SITE}/${u}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

console.log(`[prerender] wrote ${5 + posts.length} pages + 404 + sitemap (${urls.length} urls)`);
