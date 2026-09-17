import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { testServices } from './helpers.js';
import { DISCORD_TTL, PROFILE_TTL, STEAM_TTL } from '../src/lib/ttl.js';

const request = (path: string, method = 'GET') =>
  new Request(`https://api.test${path}`, { method });

// Upstreams the batch fans out to. Only the cards under test answer; the rest
// fail, which is exactly the degradation the batch has to survive.
function batchServices(now = () => 1000) {
  return testServices({
    now,
    fetch: async (input) => {
      const url = String(input);
      if (url.includes('api.lanyard.rest'))
        return Response.json({
          success: true,
          data: {
            discord_user: { id: '123456789', username: 'someone', avatar: 'abc' },
            discord_status: 'online',
            activities: [],
          },
        });
      if (url.includes('api.github.com/users'))
        return Response.json({
          login: 'someone',
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
        });
      if (url.includes('github-contributions-api'))
        return Response.json({ contributions: [{ date: '2026-01-01', count: 2, level: 1 }] });
      if (url.includes('gitlab.com/api'))
        return Response.json([{ username: 'someone', avatar_url: null }]);
      throw new Error('upstream down');
    },
  });
}

async function batch(path: string, services = batchServices()) {
  const response = await handleRequest(request(path), services);
  return {
    response,
    body: (await response.json()) as {
      generatedAt: number;
      cards: Record<string, { maxAge: number; data?: unknown; error?: string }>;
    },
  };
}

test('batch answers every card, isolates failures and stays uncached', async () => {
  const { response, body } = await batch('/links');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.generatedAt, 1000);
  assert.deepEqual(Object.keys(body.cards).sort(), [
    'discord',
    'github',
    'githubContributions',
    'gitlab',
    'linkedin',
    'spotify',
    'steam',
    'telegram',
    'x',
  ]);
  // Healthy cards carry data; the others degrade to an error of their own.
  assert.equal((body.cards.github.data as { login: string }).login, 'someone');
  assert.ok(body.cards.discord.data);
  assert.ok(body.cards.githubContributions.data);
  assert.ok(body.cards.gitlab.data);
  for (const key of ['linkedin', 'telegram', 'x', 'spotify', 'steam']) {
    assert.ok(body.cards[key].error, `${key} should report an error`);
    assert.equal(body.cards[key].data, undefined);
  }
});

test('each card reports the max-age its own route sends', async () => {
  const services = batchServices();
  const { body } = await batch('/links', services);
  for (const [key, path] of [
    ['discord', '/discord'],
    ['github', '/github'],
    ['gitlab', '/gitlab'],
  ] as const) {
    const single = await handleRequest(request(path), batchServices());
    const maxAge = Number(
      /max-age=(\d+)/.exec(single.headers.get('Cache-Control') || '')?.[1] || 0,
    );
    assert.equal(body.cards[key].maxAge, maxAge, `${key} max-age must match ${path}`);
  }
  assert.equal(body.cards.discord.maxAge, 60);
  assert.equal(body.cards.github.maxAge, 3600);
});

test('no card is advertised as fresher than its own refresh cadence', async () => {
  // A zone-level Browser Cache TTL rewrites Cache-Control on cached responses
  // (Discord came back as max-age=14400 in production, not 60), so the header
  // alone cannot be trusted: every card is capped at the TTL its route uses.
  const { body } = await batch('/links');
  const caps: Record<string, number> = {
    discord: DISCORD_TTL,
    steam: STEAM_TTL,
    spotify: 0,
    telegram: PROFILE_TTL,
    x: PROFILE_TTL,
    linkedin: PROFILE_TTL,
    github: PROFILE_TTL,
    githubContributions: PROFILE_TTL,
    gitlab: PROFILE_TTL,
  };
  for (const [key, cap] of Object.entries(caps))
    assert.ok(body.cards[key].maxAge <= cap, `${key} must not exceed ${cap}s`);
});

test('batch cards carry the same rewritten media URLs as their own route', async () => {
  const { body } = await batch('/links');
  const avatar = (body.cards.github.data as { avatar_url: string }).avatar_url;
  const single = (await (await handleRequest(request('/github'), batchServices())).json()) as {
    avatar_url: string;
  };
  assert.equal(avatar, single.avatar_url);
  assert.match(avatar, /^https:\/\/api\.test\/media\/github\//);
  // The relative avatar path of a nested card is made absolute too.
  assert.equal(
    (body.cards.discord.data as { avatar: string }).avatar,
    'https://api.test/discord/avatar',
  );
});

test('include and exclude select cards and ignore unknown keys', async () => {
  const only = await batch('/links?include=github,gitlab,bogus');
  assert.deepEqual(Object.keys(only.body.cards).sort(), ['github', 'gitlab']);

  const without = await batch('/links?exclude=spotify,steam,linkedin,telegram,x,bogus');
  assert.deepEqual(Object.keys(without.body.cards).sort(), [
    'discord',
    'github',
    'githubContributions',
    'gitlab',
  ]);

  // An empty include is not a selection; it falls back to every card.
  const all = await batch('/links?include=');
  assert.equal(Object.keys(all.body.cards).length, 9);

  // Exclude wins over include for the same key.
  const conflict = await batch('/links?include=github,gitlab&exclude=gitlab');
  assert.deepEqual(Object.keys(conflict.body.cards), ['github']);
});

test('batch warms the same cache entries the single-card routes use', async () => {
  let calls = 0;
  const services = testServices({
    fetch: async (input) => {
      calls++;
      if (String(input).includes('api.github.com/users'))
        return Response.json({
          login: 'someone',
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
        });
      throw new Error('upstream down');
    },
  });
  await handleRequest(request('/links?include=github'), services);
  assert.equal(calls, 1);
  // The single-card route now answers from the entry the batch populated.
  const single = await handleRequest(request('/github'), services);
  assert.equal(single.status, 200);
  assert.equal(calls, 1);
});

test('batch honours HEAD, OPTIONS and rejects other methods', async () => {
  const services = batchServices();
  const head = await handleRequest(request('/links', 'HEAD'), services);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await handleRequest(request('/links', 'OPTIONS'), services)).status, 200);
  const post = await handleRequest(request('/links', 'POST'), services);
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, HEAD, OPTIONS');
  // The batch is reachable under the /api prefix too.
  assert.equal((await handleRequest(request('/api/links'), services)).status, 200);
});

test('batch cannot be steered at an unconfigured account', async () => {
  const { body } = await batch('/links?include=github&username=someone-else');
  assert.equal((body.cards.github.data as { login: string }).login, 'someone');
});
