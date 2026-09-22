// Build-time blog index builder.
//
// Scans the .md files under content/blogs/ (repo root), reads YAML frontmatter,
// and returns the blog index as a JSON string. Authors just drop .md files
// anywhere under blogs/ — no manifest to maintain. A file with no frontmatter
// `title` is treated as a draft and left out.
//
// Browsers can't list a directory over static hosting (GitHub Pages), so the
// Vite plugin (vite.config.js) calls this and serves the result virtually in
// dev / emits it as an asset at build — nothing is written to disk.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

/** Minimal YAML-frontmatter parser. Returns { meta, body }. */
function parseFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const body = text.slice(m[0].length);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const val = kv[2].trim();
    if (key === 'tags') {
      const inner = val.replace(/^\[|\]$/g, '');
      meta.tags = inner
        ? inner
            .split(',')
            .map((t) => t.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean)
        : [];
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body };
}

/**
 * The post page renders the frontmatter title as its <h1>. A body that opens
 * by repeating it as `# Title` would show the heading twice and give the page
 * two <h1>s, so that one line is dropped. Any other opening heading stays.
 */
function dropRepeatedTitle(body, title) {
  return body.replace(/^\s*#[ \t]+(.+?)[ \t#]*(?:\r?\n|$)/, (line, text) =>
    text.trim() === title.trim() ? '' : line,
  );
}

/** Recursively collect every .md path under dir. */
function walkMarkdown(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full, base));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      out.push(relative(base, full));
  }
  return out;
}

/**
 * Build the blog index from the markdown files.
 * @param {string} blogsDir absolute path to content/blogs
 * @returns {{ json: string, count: number }}
 */
export function buildBlogIndex(blogsDir) {
  const posts = walkMarkdown(blogsDir)
    .map((path) => {
      const { meta, body } = parseFrontmatter(readFileSync(join(blogsDir, path), 'utf8'));
      if (!meta.title) return null; // no frontmatter title → draft, skip
      return {
        slug: basename(path).replace(/\.md$/i, ''),
        path: path.split('\\').join('/'),
        title: meta.title,
        date: meta.date || '',
        description: meta.description || meta.excerpt || '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        body: dropRepeatedTitle(body, meta.title),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const slugs = new Set();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate blog slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  return { json: JSON.stringify(posts), count: posts.length };
}
