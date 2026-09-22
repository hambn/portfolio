import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'parse5';
import { routes } from '../src/routes.js';
import { buildBlogIndex } from './blog-index.mjs';
import { routeMetadata } from '../src/lib/metadata.js';

const site = (process.env.SITE_URL || 'https://hgh.dev').replace(/\/+$/, '');
const base = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const root = `${site}${base}`;
const profile = JSON.parse(readFileSync('public/contents/home/profile.json', 'utf8'));
const posts = JSON.parse(buildBlogIndex('public/contents/blogs').json);
const read = (file) => readFileSync(`dist/${file}`, 'utf8');
function elements(node) {
  return [node, ...(node.childNodes || []).flatMap(elements)];
}
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;

for (const route of [
  ...routes.map((entry) => entry.page),
  ...posts.map((post) => `blog/${post.slug}`),
]) {
  test(`static metadata and content for ${route}`, () => {
    const metadata = routeMetadata(route, profile, posts);
    const html = read(`${metadata.path ? `${metadata.path}/` : ''}index.html`);
    const nodes = elements(parse(html));
    const canonicals = nodes.filter(
      (node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical',
    );
    const url = `${root}/${metadata.path ? `${metadata.path}/` : ''}`;
    assert.equal(canonicals.length, 1);
    assert.equal(attr(canonicals[0], 'href'), url);
    assert.equal(
      attr(
        nodes.find((node) => attr(node, 'property') === 'og:url'),
        'content',
      ),
      url,
    );
    assert.equal(
      attr(
        nodes.find((node) => attr(node, 'name') === 'description'),
        'content',
      ),
      metadata.desc,
    );
    assert.equal(
      attr(
        nodes.find((node) => attr(node, 'property') === 'og:description'),
        'content',
      ),
      metadata.desc,
    );
    for (const [attribute, name, expected] of [
      ['name', 'twitter:image', profile.avatar],
      ['name', 'twitter:image:alt', profile.name],
      ['property', 'og:image:alt', profile.name],
    ]) {
      assert.equal(
        attr(
          nodes.find((node) => attr(node, attribute) === name),
          'content',
        ),
        expected,
      );
    }
    assert.ok(nodes.some((node) => node.tagName === 'main'));
    // One top-level heading per page: a post body repeating its title as `# Title`
    // would otherwise add a second one.
    assert.equal(nodes.filter((node) => node.tagName === 'h1').length, 1);
    assert.ok(nodes.some((node) => node.tagName === 'h1'));
    const script = nodes.find((node) => attr(node, 'type') === 'application/ld+json');
    const graph = JSON.parse(script.childNodes[0].value)['@graph'];
    assert.equal(graph[1].url, url);
    for (const breadcrumb of graph.find((node) => node['@type'] === 'BreadcrumbList')
      ?.itemListElement || []) {
      assert.ok(breadcrumb.item.startsWith(`${root}/`));
    }
    assert.ok(read('sitemap.xml').includes(`<loc>${url}</loc>`));
    assert.ok(!html.includes('name="robots" content="noindex"'));
  });
}

test('feeds and crawler hints respect the deployment base', () => {
  assert.ok(read('robots.txt').includes(`Sitemap: ${root}/sitemap.xml`));
  assert.ok(read('feed.xml').includes(`href="${root}/feed.xml"`));
  assert.ok(read('404.html').includes('name="robots" content="noindex"'));
  for (const post of posts)
    assert.ok(read('feed.xml').includes(`<link>${root}/blog/${post.slug}/</link>`));
});

test('blog discovery omits drafts and rejects duplicate route slugs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'portfolio-blog-'));
  try {
    mkdirSync(join(directory, 'nested'));
    writeFileSync(join(directory, 'draft.md'), '# Draft');
    writeFileSync(join(directory, 'post.md'), '---\ntitle: Published\n---\nBody');
    assert.equal(buildBlogIndex(directory).count, 1);
    writeFileSync(join(directory, 'nested/post.md'), '---\ntitle: Duplicate\n---\nBody');
    assert.throws(() => buildBlogIndex(directory), /Duplicate blog slug: post/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
