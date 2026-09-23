import { test, expect } from '@playwright/test';

const paths = [
  '/',
  '/projects/',
  '/blog/',
  '/links/',
  '/resume/',
  '/blog/welcome/',
  '/blog/docker-multistage/',
  '/blog/gitops-with-argocd/',
  '/blog/nixos-homelab/',
  // Static hosts serve the directory index under its own name as well.
  '/blog/index.html',
  '/blog/welcome/index.html',
];

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**/api/discord/socket', () => {});
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } }),
  );
});

for (const width of [390, 1280]) {
  test(`all static routes hydrate without replacing content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|hydrated|Minified React/.test(message.text()))
        errors.push(message.text());
    });
    for (const path of paths) {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route('**/assets/*.js', async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto(path, { waitUntil: 'commit' });
      await expect(page.locator('main').first()).toBeVisible();
      await page.evaluate(() => {
        window.originalMain = document.querySelector('main');
      });
      release();
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('button', { name: 'toggle theme' })).toBeVisible();
      await page.getByRole('button', { name: 'toggle theme' }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.getByRole('button', { name: 'toggle theme' }).click();
      expect(
        await page.evaluate(() => window.originalMain === document.querySelector('main')),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.unroute('**/assets/*.js');
    }
    expect(errors).toEqual([]);
  });
}

test('navigation updates canonical, social metadata and structured data together', async ({
  page,
}) => {
  await page.goto('/blog/welcome/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await page.getByRole('button', { name: 'all posts' }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://hgh.dev/blog/',
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property^="article:"]')).toHaveCount(0);
  await page.locator('a.post-row-link[href$="/welcome/"]').click();
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://hgh.dev/blog/welcome/',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /How this blog works/,
  );
  const graph = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(graph)['@graph'].find((node) => node['@type'] === 'BlogPosting').url).toBe(
    'https://hgh.dev/blog/welcome/',
  );
  await page.goBack();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://hgh.dev/blog/',
  );
});

test('prerendered posts skip markdown parsing and still highlight code and wrap tables', async ({
  page,
}) => {
  const scripts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/blog/welcome/');
  await expect(page.locator('code.hljs')).toBeVisible();
  await expect(page.locator('.code-copy')).toBeVisible();
  await expect(page.locator('.table-wrap table')).toBeVisible();
  expect(scripts.some((url) => /\/markdown-/.test(url))).toBe(false);
  expect(scripts.some((url) => /\/highlight-/.test(url))).toBe(true);
  await page.getByRole('button', { name: 'all posts' }).click();
  await page.locator('a.post-row-link[href$="/docker-multistage/"]').click();
  await expect(page.locator('.markdown-body code.hljs').first()).toBeVisible();
  expect(scripts.some((url) => /\/markdown-/.test(url))).toBe(true);
});

test('home skips blog styles and mobile timeline is readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.git-when').first()).toBeVisible();
  await expect(page.locator('.git-meta').first()).toBeHidden();
  expect(
    await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.some((link) => /\/Blog-/.test(link.href))),
  ).toBe(false);
  await context.close();
});

test('diagram posts render Mermaid on demand', async ({ page }) => {
  await page.goto('/blog/gitops-with-argocd/');
  await expect(page.locator('.mermaid svg')).toBeVisible();
});

test('a not-found view is noindex and navigating on restores indexing', async ({ page }) => {
  const notFound = await (await page.request.get('/404.html')).text();
  await page.route('**/nope/', (route) =>
    route.fulfill({ contentType: 'text/html', body: notFound }),
  );
  const robots = () => page.locator('meta[name="robots"]').getAttribute('content');

  await page.goto('/nope/');
  await expect(page).toHaveTitle(/^not found — /);
  expect(await robots()).toBe('noindex');
  expect(await page.locator('link[rel="canonical"]').count()).toBe(0);

  await page.locator('nav a[href="/projects/"]').click();
  await expect(page).toHaveTitle(/^projects — /);
  expect(await robots()).toContain('index, follow');

  await page.evaluate(() => {
    history.pushState({}, '', '/blog/no-such-post/');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveTitle(/^not found — /);
  expect(await robots()).toBe('noindex');
});

test('opening a post from the prerendered list keeps the page mounted', async ({ page }) => {
  await page.goto('/blog/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    window.sawFallback = false;
    new MutationObserver(() => {
      if (document.querySelector('.page-loading')) window.sawFallback = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.locator('a.post-row-link').first().click();
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => window.sawFallback)).toBe(false);
});
