import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.ok(nodes.some((node) => node.tagName === 'main'));
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
