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
    if (url.pathname.includes('/media/') || url.pathname.endsWith('/avatar')) {
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
    .poll(() => requested.some((path) => path.startsWith('/api/media/linkedin/')))
    .toBe(true);
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/media/discord/')))
    .toBe(true);
  await page.goto('/');
  await expect
    .poll(() => requested.some((path) => path.startsWith('/api/media/github/')))
    .toBe(true);
  await page.goto('/projects/');
  await expect.poll(() => requested.includes('/api/github/repos')).toBe(true);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
