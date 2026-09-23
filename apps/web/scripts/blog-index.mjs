// Build-time blog index builder.
//
// Scans the .md files under content/blogs/ (repo root), reads YAML frontmatter,
// and returns the blog index as a JSON string. Authors just drop .md files
// anywhere under blogs/ — no manifest to maintain. A file with no frontmatter
// `title`, or with `draft: true`, is a draft and left out. Frontmatter the
// parser cannot read faithfully, an invalid date or a slug that is not plain
// lowercase fails the build instead of publishing something wrong.
//
// Browsers can't list a directory over static hosting (GitHub Pages), so the
// Vite plugin (vite.config.js) calls this and serves the result virtually in
// dev / emits it as an asset at build — nothing is written to disk.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

/** One scalar: YAML's quoted forms unescaped, anything else as written. */
function scalar(value) {
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (/^'(?:[^']|'')*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/**
 * Minimal YAML-frontmatter parser: one `key: value` per line, and tags as a
 * flow list (`[a, b]`). Returns { meta, body }. Anything this parser would
 * silently misread (block lists, folded or literal text) is an error instead.
 */
function parseFrontmatter(raw, path) {
  const text = raw.replace(/^\uFEFF/, '');
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const body = text.slice(m[0].length);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv || /^[>|][+-]?$/.test(kv[2].trim()))
      throw new Error(
        `${path}: unsupported frontmatter line "${line.trim()}" — use one "key: value" per line and tags: [a, b]`,
      );
    const key = kv[1].trim();
    const val = kv[2].trim();
    if (key === 'tags') {
      const inner = val.replace(/^\[|\]$/g, '');
      meta.tags = inner
        ? inner
            .split(',')
            .map((t) => scalar(t.trim()))
            .filter(Boolean)
        : [];
    } else {
      meta[key] = scalar(val);
    }
  }
  return { meta, body };
}

// Slugs become URLs, feed links and sitemap entries, so they stay plain.
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** A real calendar date in YYYY-MM-DD form, or null. */
function validDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return date.toISOString().slice(0, 10) === value ? value : null;
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
      const { meta, body } = parseFrontmatter(readFileSync(join(blogsDir, path), 'utf8'), path);
      // No title, or draft: true → a draft, skipped.
      if (!meta.title || String(meta.draft).toLowerCase() === 'true') return null;
      const slug = basename(path).replace(/\.md$/i, '');
      if (!SLUG.test(slug))
        throw new Error(`${path}: file name must be lowercase letters, digits and hyphens`);
      if (meta.date && !validDate(meta.date))
        throw new Error(`${path}: date "${meta.date}" is not a real YYYY-MM-DD date`);
      return {
        slug,
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
