import { test, expect } from '@playwright/test';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
// The cards and the projects page ask a provider themselves when the API has
// nothing for them. No test may reach the real ones: each is refused here, and
// the tests about that fallback route the hosts they need over this.
const PROVIDERS = [
  'https://api.github.com/**',
  'https://pinned.berrysauce.dev/**',
  'https://github-contributions-api.jogruber.de/**',
  'https://gitlab.com/**',
  'https://codeberg.org/**',
  'https://api.lanyard.rest/**',
  'wss://api.lanyard.rest/**',
];
test.beforeEach(async ({ page }) => {
  for (const pattern of PROVIDERS.filter((url) => url.startsWith('https')))
    await page.route(pattern, (route) => route.abort());
});

test('rendered provider content and presence use only the configured host', async ({ page }) => {
  const external = [];
  const requested = [];
  const siteRequests = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') external.push(request.url());
  });
  await page.routeWebSocket('**/api/discord/socket', (socket) => {
    socket.send(JSON.stringify({ op: 1, d: { heartbeat_interval: 30000 } }));
    socket.onMessage(() =>
      socket.send(
        JSON.stringify({
          op: 0,
          d: {
            discord_user: { id: '123', username: 'tester', avatar: 'avatar' },
            discord_status: 'online',
            activities: [
              { type: 0, name: 'Game', application_id: '123', assets: { large_image: '456' } },
            ],
          },
        }),
      ),
    );
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.pathname);
    if (
      url.pathname.includes('/media/') ||
      url.pathname.endsWith('/avatar') ||
      url.pathname.endsWith('/banner')
    ) {
      return route.fulfill({ contentType: 'image/png', body: pixel });
    }
    const artwork = { url: '/api/media/spotify/test' };
    const responses = {
      '/api/spotify': {
        status: { is_playing: false, item: null },
        profile: { display_name: 'Tester', images: [artwork] },
        topTracks: { items: [] },
        topArtists: { items: [] },
        recent: { items: [] },
        playlists: [],
      },
      '/api/discord': {
        username: 'tester',
        id: '123',
        avatar: '/api/discord/avatar',
        status: 'online',
        activities: [],
      },
      '/api/linkedin': {
        username: 'hambn',
        name: 'LinkedIn Tester',
        headline: 'Engineer',
        location: 'Tehran, Iran',
        followers: '655',
        connections: '500+',
        avatar: '/api/linkedin/avatar',
        banner: '/api/linkedin/banner',
        about: 'I like numbers.',
        organizations: ['Example Company', 'Technical University'],
        languages: [{ name: 'Persian', proficiency: 'Native or bilingual proficiency' }],
      },
      '/api/telegram': {
        username: 'ham_bn',
        name: 'Telegram Tester',
        photo: '/api/telegram/avatar',
        description: 'Hello',
      },
      '/api/steam': {
        displayName: 'Steam Tester',
        avatar: { large: '/api/media/steam/test' },
        level: 1,
        totalGames: 0,
        status: 'Offline',
        recentActivity: [],
      },
      '/api/github': { login: 'hambn', avatar_url: '/api/media/github/test', name: 'Tester' },
      '/api/gitlab': [{ username: 'ham_bn', avatar_url: '/api/media/gitlab/test', name: 'Tester' }],
      '/api/github/contributions': { contributions: [{ date: '2026-09-17', count: 1, level: 1 }] },
      '/api/gitlab/contributions': {
        total: { lastYear: 7 },
        contributions: [{ date: '2026-09-17', count: 7, level: 1 }],
      },
      '/api/projects': {
        updatedAt: '2026-01-01T00:00:00.000Z',
        featured: [
          {
            id: 'github:tester/featured',
            host: 'github',
            name: 'stale-featured',
            description: 'from the api',
            repo: 'https://github.com/tester/featured',
            homepage: null,
            language: null,
            stars: 0,
            forks: 0,
            topics: [],
            pushedAt: null,
            archived: false,
            fork: false,
          },
        ],
        sections: [
          {
            host: 'github',
            username: 'tester',
            url: 'https://github.com/tester',
            repos: [
              {
                id: 'github:tester/listed',
                host: 'github',
                name: 'listed-repo',
                description: 'a listed repository',
                repo: 'https://github.com/tester/listed',
                homepage: 'https://listed.example/',
                language: 'Go',
                stars: 4,
                forks: 0,
                topics: [],
                pushedAt: '2026-01-01T00:00:00.000Z',
                archived: false,
                fork: false,
              },
            ],
          },
          // A host with nothing to list is never drawn.
          { host: 'gitlab', username: 'tester', url: 'https://gitlab.com/tester', repos: [] },
        ],
      },
    };
    // The site-wide request: every asked-for card, as its own route answers it.
    if (url.pathname === '/api/site') {
      const paths = {
        githubContributions: '/api/github/contributions',
        gitlabContributions: '/api/gitlab/contributions',
      };
      const keys = (url.searchParams.get('include') || '').split(',').filter(Boolean);
      siteRequests.push(keys);
      return route.fulfill({
        json: {
          generatedAt: Date.now(),
          cards: Object.fromEntries(
            keys.map((key) => {
              const data = responses[paths[key] || `/api/${key}`];
              return [key, data ? { maxAge: 300, data } : { maxAge: 0, error: 'unavailable' }];
            }),
          ),
        },
      });
    }
    return route.fulfill({ json: responses[url.pathname] || {} });
  });
  await page.goto('/links/');
  await expect(page.getByText('Telegram Tester', { exact: true })).toBeVisible();
  // The links page asks once, for its cards and the projects listing together.
  expect(siteRequests).toHaveLength(1);
  expect(siteRequests[0]).toEqual(
    expect.arrayContaining(['github', 'gitlabContributions', 'telegram', 'projects']),
  );
  // GitLab's graph is the account's real activity, from the API.
  await expect(page.locator('[data-card="gl"] .cg-weeks')).toHaveAttribute(
    'aria-label',
    '7 contributions in the last year',
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/media/spotify/')))
    .toBe(true);
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/linkedin/avatar')))
    .toBe(true);
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/media/discord/')))
    .toBe(true);
  const linkedin = page.getByRole('region', { name: 'LinkedIn profile' });
  await expect(linkedin.getByText('LinkedIn Tester', { exact: true })).toBeVisible();
  await expect(linkedin.getByText('655 followers')).toBeVisible();
  await expect(linkedin.getByText('I like numbers.')).toBeVisible();
  await expect(linkedin.getByText('Native or bilingual proficiency')).toBeVisible();
  await linkedin.screenshot({ path: '/tmp/portfolio-linkedin-card.png' });
  await page.goto('/');
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/media/github/')))
    .toBe(true);
  await page.goto('/projects/');
  // Everything the page needs arrives in the site-wide request.
  await expect(page.getByRole('link', { name: 'listed-repo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'github', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'gitlab', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /listed\.example/ })).toBeVisible();
  // Content decides the featured cards; the API answer cannot add one.
  await expect(page.getByText('stale-featured')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'featured', exact: true })).toBeVisible();
  expect(requested.filter((path) => path === '/api/projects')).toHaveLength(0);
  // Once per page load (links, home, projects), never once per page section.
  expect(siteRequests.filter((keys) => keys.includes('projects'))).toHaveLength(3);
  expect(requested.filter((path) => path.startsWith('/api/git'))).toEqual(
    requested.filter((path) => path.startsWith('/api/git') && !path.includes('repos')),
  );
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('LinkedIn unavailable state does not show old hardcoded profile details', async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'linkedin_cache_pending' } }),
  );
  await page.goto('/links/');
  const linkedin = page.getByRole('region', { name: 'LinkedIn profile' });
  await expect(linkedin.getByRole('status')).toHaveText(
    'Profile unavailable. You can still open LinkedIn.',
  );
  await expect(linkedin.getByRole('link', { name: 'View profile', exact: true })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/hambn/',
  );
  await expect(linkedin.getByText('654 followers')).toHaveCount(0);
});

test('the contact form waits out a new token and retries a refused one', async ({ page }) => {
  const minted = [];
  const posts = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/contact' && request.method() === 'GET') {
      minted.push(Date.now());
      return route.fulfill({ json: { to: 'me@example.com', token: `token-${minted.length}` } });
    }
    if (url.pathname === '/api/contact' && request.method() === 'POST') {
      const { token } = request.postDataJSON();
      posts.push({ token, at: Date.now() });
      // The first token is refused, as it would be if it had expired.
      return posts.length === 1
        ? route.fulfill({ status: 403, json: { error: 'invalid_token' } })
        : route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 503, json: { error: 'unavailable' } });
  });
  await page.goto('/links/');
  await page.getByPlaceholder('your@email.com').fill('visitor@example.com');
  await page.getByLabel('Message').fill('A message that is long enough.');
  await page.locator('.em-style-1 button[type="submit"]').click();
  await expect(page.locator('.em-style-1').getByRole('status')).toContainText('Sent', {
    timeout: 15000,
  });

  expect(posts.map((post) => post.token)).toEqual(['token-1', 'token-2']);
  // The retried token was only used once it was old enough for the API.
  expect(posts[1].at - minted[1]).toBeGreaterThanOrEqual(3000);
});

test('a card with malformed provider data is hidden without blanking the page', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/discord/socket', () => {});
  await page.route('https://api.portfolio.hgh.dev/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } }),
  );
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/site')
      return route.fulfill({
        json: { cards: { steam: { maxAge: 300, data: { recentActivity: 'not a list' } } } },
      });
    return route.fulfill({ status: 503, json: { error: 'unavailable' } });
  });
  await page.goto('/links/');
  await expect(page.getByRole('heading', { name: 'links', level: 1 })).toBeVisible();
  await expect(page.locator('.em-style-1')).toBeVisible();
  await expect(page.getByRole('navigation').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('returning to the tab refetches only cards whose poll is due', async ({ page }) => {
  const requested = [];
  await page.routeWebSocket('**/api/discord/socket', () => {});
  await page.route('**/api/**', (route) => {
    const { pathname } = new URL(route.request().url());
    requested.push(pathname);
    const responses = {
      '/api/telegram': { username: 'ham_bn', name: 'Telegram Tester', description: 'Hello' },
      '/api/linkedin': { username: 'hambn', name: 'LinkedIn Tester' },
    };
    return responses[pathname]
      ? route.fulfill({ json: responses[pathname] })
      : route.fulfill({ status: 503, json: { error: 'unavailable' } });
  });
  await page.goto('/links/');
  await expect(page.getByText('Telegram Tester', { exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const count = (path) => requested.filter((item) => item === path).length;
  const before = { telegram: count('/api/telegram'), linkedin: count('/api/linkedin') };

  for (const hidden of [true, false])
    await page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await page.waitForTimeout(1000);

  // Both poll hourly and answered moments ago.
  expect({ telegram: count('/api/telegram'), linkedin: count('/api/linkedin') }).toEqual(before);
});

test('cards collapsed on a previous visit do not open and shut on load', async ({ page }) => {
  await page.routeWebSocket('**/api/discord/socket', () => {});
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'unavailable' } }),
  );
  await page.addInitScript(() => {
    for (const card of ['email', 'dc', 'tg', 'x', 'gh', 'gl', 'li', 'sp', 'st'])
      localStorage.setItem(`${card}_card_collapsed`, '1');
    window.shift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.shift += entry.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/links/');
  await page.waitForLoadState('networkidle');
  expect(await page.locator('.sc-body.open').count()).toBe(0);
  expect(await page.evaluate(() => window.shift)).toBeLessThan(0.01);

  // Expanding one afterwards still opens it.
  await page.locator('.sc-body[data-card="gh"]').locator('xpath=..').getByTitle('Expand').click();
  await expect(page.locator('.sc-body[data-card="gh"]')).toBeVisible();
});

test('a host the API cannot reach keeps the section this browser saw last', async ({ page }) => {
  const repo = (host, name) => ({
    id: `${host}:tester/${name}`,
    host,
    name,
    description: null,
    repo: `https://${host}.com/tester/${name}`,
    homepage: null,
    language: null,
    stars: 0,
    forks: 0,
    topics: [],
    pushedAt: null,
    archived: false,
    fork: false,
  });
  const section = (host, name) => ({
    host,
    username: 'tester',
    url: `https://${host}.com/tester`,
    repos: [repo(host, name)],
  });
  const answers = [
    // A complete answer, then one built while GitHub refused the API.
    {
      updatedAt: '2026-01-01T00:00:00.000Z',
      featured: [],
      sections: [section('github', 'gh-repo'), section('gitlab', 'gl-repo')],
      unavailable: [],
    },
    {
      updatedAt: '2026-01-02T00:00:00.000Z',
      featured: [],
      sections: [section('gitlab', 'gl-repo')],
      unavailable: [{ host: 'github', username: 'tester', url: 'https://github.com/tester' }],
    },
  ];
  let served = 0;
  await page.route('**/api/site**', (route) => {
    const keys = new URL(route.request().url()).searchParams.get('include') || '';
    return route.fulfill({
      json: {
        cards: keys.split(',').includes('projects')
          ? { projects: { maxAge: 300, data: answers[served++] } }
          : {},
      },
    });
  });

  await page.goto('/projects/');
  await expect(page.getByRole('link', { name: 'gh-repo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'gl-repo' })).toBeVisible();
  // Still listed, first, from the earlier answer; nothing claims it is missing.
  await expect(page.getByRole('link', { name: 'gh-repo' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 }).nth(1)).toHaveText('github');
  await expect(page.getByText('is not answering')).toHaveCount(0);

  // A browser that never saw GitHub's list is told why it is not there.
  await page.evaluate(() => localStorage.clear());
  served = 1;
  await page.reload();
  await expect(page.getByRole('link', { name: 'gl-repo' })).toBeVisible();
  await expect(page.getByText('github is not answering right now')).toBeVisible();
  await expect(page.getByRole('link', { name: 'gh-repo' })).toHaveCount(0);
});

test('with the API down, cards and projects ask the providers themselves', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/discord/socket', (socket) => socket.close());
  await page.routeWebSocket('wss://api.lanyard.rest/socket', () => {});
  await page.route('**/api/**', (route) => route.abort());
  const json = (body) => (route) => route.fulfill({ json: body });
  await page.route(
    'https://api.github.com/users/hambn',
    json({
      login: 'hambn',
      name: 'Direct Tester',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      followers: 3,
      following: 4,
      public_repos: 1,
    }),
  );
  await page.route(
    'https://api.github.com/users/hambn/repos**',
    json([
      {
        name: 'direct-repo',
        full_name: 'hambn/direct-repo',
        html_url: 'https://github.com/hambn/direct-repo',
        owner: { login: 'hambn' },
        language: 'Go',
        stargazers_count: 2,
      },
    ]),
  );
  await page.route(
    'https://github-contributions-api.jogruber.de/**',
    json({ total: { lastYear: 5 }, contributions: [{ date: '2026-09-17', count: 5, level: 2 }] }),
  );
  await page.route(
    'https://gitlab.com/api/v4/users?username=ham_bn',
    json([{ username: 'ham_bn', name: 'GitLab Direct', avatar_url: null }]),
  );
  await page.route('https://gitlab.com/api/v4/users/ham_bn/projects**', json([]));
  await page.route(
    'https://api.lanyard.rest/v1/users/**',
    json({
      success: true,
      data: {
        discord_user: { id: '1', username: 'direct_discord', global_name: 'Discord Direct' },
        discord_status: 'idle',
        activities: [],
      },
    }),
  );
  await page.route('https://avatars.githubusercontent.com/**', (route) => route.abort());

  await page.goto('/links/');
  const github = page.locator('[data-card="gh"]');
  await expect(github.getByText('Direct Tester')).toBeVisible();
  // The pinned service is refused, so the most starred repositories stand in.
  await expect(github.getByRole('link', { name: 'direct-repo' })).toBeVisible();
  await expect(github.getByText('5 contributions in the last year')).toBeVisible();
  await expect(page.locator('[data-card="gl"]').getByText('GitLab Direct')).toBeVisible();
  // GitLab's calendar cannot be read cross-origin: no graph rather than a made-up one.
  await expect(page.locator('[data-card="gl"] .cg')).toHaveCount(0);
  await expect(page.locator('[data-card="dc"]').getByText('Discord Direct')).toBeVisible();
  // Cards with no public source of their own say so and keep their links.
  await expect(
    page.getByRole('region', { name: 'LinkedIn profile' }).getByRole('status'),
  ).toHaveText('Profile unavailable. You can still open LinkedIn.');

  await page.goto('/projects/');
  await expect(page.getByRole('link', { name: 'direct-repo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'github', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
