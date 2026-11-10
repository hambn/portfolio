import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { refreshProjects } from '../src/providers/projects.js';
import { PROJECTS_RESPONSE_TTL, PROJECTS_TTL } from '../src/lib/ttl.js';
import { projectsContent } from '../src/identities.js';
import { featuredProjects, projectAccounts } from '@portfolio/shared/projects';
import { testServices } from './helpers.js';

// These run against the real content/projects/projects.json: which accounts
// and which featured repositories the route serves is content, so the tests
// derive their expectations from it instead of repeating it.
const accounts = projectAccounts(projectsContent);
const featured = featuredProjects(projectsContent);
const github = accounts.find((account) => account.host === 'github')!;

interface Body {
  updatedAt: string | null;
  featured: { id: string; name: string; stars: number; homepage: string | null }[];
  sections: { host: string; username: string; repos: { id: string; name: string }[] }[];
}

const request = (path = '/projects') => new Request(`https://api.test${path}`);

const githubRepo = (name: string, extra: Record<string, unknown> = {}) => ({
  full_name: `${github.username}/${name}`,
  description: `${name} description`,
  homepage: '',
  language: 'TypeScript',
  stargazers_count: 0,
  forks_count: 0,
  topics: [],
  pushed_at: '2026-01-01T00:00:00Z',
  archived: false,
  fork: false,
  ...extra,
});

/** Hosts that answer: GitHub with the featured repositories plus two more, the others empty. */
function upstream(calls: string[], down: () => boolean = () => false) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (down()) return new Response('rate limited', { status: 403 });
    if (url.includes('api.github.com/users/'))
      return Response.json([
        githubRepo('quiet'),
        githubRepo('forked', { fork: true, stargazers_count: 50 }),
        githubRepo('popular', { stargazers_count: 9, homepage: 'popular.example' }),
        ...featured
          .filter((project) => project.host === 'github')
          .map((project) => githubRepo(project.name, { stargazers_count: 3 })),
      ]);
    return Response.json([]);
  };
}

async function read(services: ReturnType<typeof testServices>) {
  const response = await handleRequest(request(), services);
  return { response, body: (await response.json()) as Body };
}

test('projects answers featured and every host in one response', async () => {
  const calls: string[] = [];
  const services = testServices({ now: () => 1_000_000, fetch: upstream(calls) });
  const { response, body } = await read(services);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), `public, max-age=${PROJECTS_RESPONSE_TTL}`);
  assert.equal(body.updatedAt, new Date(1_000_000).toISOString());

  // Content order, with what the host reported laid underneath.
  assert.deepEqual(
    body.featured.map((project) => project.id),
    featured.map((project) => project.id),
  );
  assert.ok(body.featured.every((project) => project.stars === 3));

  // Hosts that returned nothing are left out; GitHub's own work comes first,
  // most starred first, and forks last however many stars they carry.
  assert.deepEqual(
    body.sections.map((section) => section.host),
    ['github'],
  );
  const names = body.sections[0].repos.map((repo) => repo.name);
  assert.equal(names[0], 'popular');
  assert.equal(names.at(-1), 'forked');
  assert.equal(names.at(-2), 'quiet');

  // One listing per configured account, and nothing per featured repository:
  // those were already in their owner's listing.
  assert.equal(calls.length, accounts.length);
});

test('projects serves later requests from its own copy', async () => {
  const calls: string[] = [];
  let now = 1_000_000;
  const services = testServices({ now: () => now, fetch: upstream(calls) });
  await read(services);
  const before = calls.length;
  // Past the response cache, inside the snapshot's lifetime.
  now += (PROJECTS_RESPONSE_TTL + 1) * 1000;
  const { body } = await read(services);
  assert.equal(calls.length, before);
  assert.equal(body.sections[0].host, 'github');
});

test('projects keeps answering from the snapshot while the hosts are down', async () => {
  const calls: string[] = [];
  let now = 1_000_000;
  let down = false;
  const pending: Promise<unknown>[] = [];
  const services = testServices({
    now: () => now,
    fetch: upstream(calls, () => down),
    background: (task) => void pending.push(task.catch(() => {})),
  });
  const first = await read(services);

  down = true;
  now += (PROJECTS_TTL + 1) * 1000;
  const before = calls.length;
  const stale = await read(services);
  // Answered at once from the old snapshot; the refresh ran behind it.
  assert.equal(stale.response.status, 200);
  assert.deepEqual(stale.body.sections, first.body.sections);
  assert.equal(stale.body.updatedAt, first.body.updatedAt);
  assert.equal(stale.response.headers.get('Cache-Control'), 'public, max-age=60');
  await Promise.all(pending);
  // The failed listings are not followed by a request per featured repository.
  assert.equal(calls.length - before, accounts.length);

  // The scheduled refresh reports the failure and leaves the snapshot alone.
  await assert.rejects(refreshProjects(services));
  now += 61_000;
  assert.deepEqual((await read(services)).body.sections, first.body.sections);
});

test('projects still answers the featured cards when no host has ever answered', async () => {
  const calls: string[] = [];
  const services = testServices({ fetch: upstream(calls, () => true) });
  const { response, body } = await read(services);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.updatedAt, null);
  assert.deepEqual(body.sections, []);
  assert.deepEqual(
    body.featured.map((project) => project.name),
    featured.map((project) => project.name),
  );
  // A second visitor inside the cooldown does not send the hosts another round.
  const before = calls.length;
  await read(services);
  assert.equal(calls.length, before);
});

test('projects never takes its accounts from the request', async () => {
  const calls: string[] = [];
  const services = testServices({ fetch: upstream(calls) });
  await handleRequest(request('/projects?username=someone-else'), services);
  assert.ok(calls.every((url) => !url.includes('someone-else')));
  assert.equal((await handleRequest(request('/github/repos'), services)).status, 404);
});
