// Build-time blog index builder.
//
// Scans the .md files under public/contents/blogs/, reads YAML frontmatter,
// and returns the blog index as a JSON string. Authors just drop .md files
// anywhere under blogs/ — no manifest to maintain. A file with no frontmatter
// `title` is treated as a draft and left out.
//
// Browsers can't list a directory over static hosting (GitHub Pages), so the
// Vite plugin (vite.config.js) calls this and serves the result virtually in
// dev / emits it as an asset at build — nothing is written to disk.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

/** Minimal YAML-frontmatter parser. Returns { meta, body }. */
function parseFrontmatter(raw) {
  const text = raw.replace(/^﻿/, '');
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
      meta.tags = inner ? inner.split(',').map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : [];
    } else {
      meta[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { meta, body };
}

/** Recursively collect every .md path under dir. */
function walkMarkdown(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkMarkdown(full, base));
    else if (entry.toLowerCase().endsWith('.md')) out.push(relative(base, full));
  }
  return out;
}

/**
 * Build the blog index from the markdown files.
 * @param {string} blogsDir absolute path to public/contents/blogs
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
        body,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return { json: JSON.stringify(posts), count: posts.length };
}
