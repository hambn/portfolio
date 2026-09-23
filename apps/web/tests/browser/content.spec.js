import { test, expect } from '@playwright/test';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
test('rendered provider content and presence use only the configured host', async ({ page }) => {
  const external = [];
  const requested = [];
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
      '/api/github/repos': [],
    };
    return route.fulfill({ json: responses[url.pathname] || {} });
  });
  await page.goto('/links/');
  await expect(page.getByText('Telegram Tester', { exact: true })).toBeVisible();
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
  await expect.poll(() => requested.includes('/api/github/repos')).toBe(true);
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
