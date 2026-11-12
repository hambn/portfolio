import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from '../src/app.js';
import { identities } from '../src/identities.js';
import { parseGitHubPage, type GitHubPage } from '../src/providers/github-page.js';
import { testServices } from './helpers.js';

const user = identities.github;

// The parts of a signed-out github.com/<user> page the scraper reads, in the
// markup GitHub serves them in.
const PAGE = `<!doctype html><html><body>
<div class="user-status-container">
  <div class="user-status-emoji-container"><g-emoji alias="expressionless">😑</g-emoji></div>
  <div class="user-status-message-wrapper"><div>trying to be DevOps engineer</div></div>
</div>
<h1 class="vcard-names"><span class="p-name">Someone</span><span class="p-nickname">${user}</span></h1>
<a class="Link--secondary" href="https://github.com/${user}?tab=followers"><svg></svg><span class="text-bold color-fg-default">1.2k</span> followers</a>
<a class="Link--secondary" href="https://github.com/${user}?tab=following"><span class="text-bold color-fg-default">42</span> following</a>
<a href="/${user}?achievement=pull-shark&amp;tab=achievements" class="position-relative">
  <img src="https://github.githubassets.com/assets/pull-shark-default.png" class="achievement-badge-sidebar" alt="Achievement: Pull Shark" data-hovercard-url="/users/${user}/achievements/pull-shark/detail?hovercard=1">
  <span class="Label achievement-tier-label achievement-tier-label--bronze">x2</span>
</a>
<a href="/${user}?achievement=yolo&amp;tab=achievements">
  <img src="https://github.githubassets.com/assets/yolo-default.png" class="achievement-badge-sidebar" alt="Achievement: YOLO" data-hovercard-url="/users/${user}/achievements/yolo/detail?hovercard=1">
</a>
<a class="avatar-group-item" data-hovercard-type="organization" href="/acme"><img src="https://avatars.githubusercontent.com/u/9?s=64&amp;v=4" alt="@acme"></a>
<article class="markdown-body entry-content" itemprop="text"><h1>Hello</h1><p>I build <script>alert(1)</script>things.</p></article>
<ol>
  <li class="pinned-item-list-item">
    <a href="/${user}/tool-containers"><span class="repo">tool-containers</span></a>
    <span class="Label Label--secondary">Public</span>
    <p class="pinned-item-desc">Containers for tools</p>
    <span class="repo-language-color" style="background-color: #384d54"></span>
    <span itemprop="programmingLanguage">Dockerfile</span>
    <a href="/${user}/tool-containers/stargazers"><svg></svg> 3</a>
    <a href="/${user}/tool-containers/forks"><svg></svg> 1</a>
  </li>
  <li class="pinned-item-list-item"><a href="https://gist.github.com/x/1">a gist</a></li>
</ol>
</body></html>`;

test('the page parser reads what only the profile page shows', () => {
  const page = parseGitHubPage(PAGE)!;
  assert.deepEqual(page.status, { emoji: '😑', message: 'trying to be DevOps engineer' });
  assert.equal(page.followers, 1200);
  assert.equal(page.following, 42);
  assert.deepEqual(
    page.achievements.map(({ slug, name, tier, count }) => ({ slug, name, tier, count })),
    [
      { slug: 'pull-shark', name: 'Pull Shark', tier: 'bronze', count: 'x2' },
      { slug: 'yolo', name: 'YOLO', tier: null, count: null },
    ],
  );
  assert.deepEqual(page.organizations, [
    {
      login: 'acme',
      url: 'https://github.com/acme',
      image: 'https://avatars.githubusercontent.com/u/9?s=64&v=4',
    },
  ]);
  // Plain text only: markup and scripts never reach the card.
  assert.equal(page.readme, 'Hello I build things.');
  assert.deepEqual(page.pinned, [
    {
      owner: user,
      name: 'tool-containers',
      url: `https://github.com/${user}/tool-containers`,
      description: 'Containers for tools',
      language: 'Dockerfile',
      color: '#384d54',
      stars: 3,
      forks: 1,
      label: 'Public',
    },
  ]);
});

test('the page parser rejects anything that is not a profile', () => {
  assert.equal(parseGitHubPage('<html><body><form action="/session"></form></body></html>'), null);
  const bare = parseGitHubPage('<h1 class="vcard-names">x</h1>')!;
  assert.equal(bare.status, null);
  assert.deepEqual(bare.pinned, []);
  assert.equal(bare.readme, null);
});

interface Profile {
  login: string;
  blog: string | null;
  followers: number | null;
  stars: number | null;
  languages: { name: string; repos: number }[];
  pulls: { state: string; repo: string }[];
  page: GitHubPage | null;
}

function profileServices(parts: { down: Set<string>; now: () => number }) {
  return testServices({
    now: parts.now,
    fetch: async (input) => {
      const url = String(input);
      const part = url.includes('/repos?')
        ? 'repos'
        : url.includes('/search/issues')
          ? 'pulls'
          : url.startsWith('https://github.com/')
            ? 'page'
            : url.includes(`api.github.com/users/${user}`)
              ? 'user'
              : 'other';
      if (parts.down.has(part)) return new Response('down', { status: 503 });
      if (part === 'user')
        return Response.json({
          login: user,
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
          blog: 'example.com',
          followers: 7,
          following: 8,
          public_repos: 3,
        });
      if (part === 'repos')
        return Response.json([
          { language: 'TypeScript', stargazers_count: 5 },
          { language: 'TypeScript', stargazers_count: 1 },
          { language: 'Go', stargazers_count: 0 },
          { language: 'Rust', stargazers_count: 40, fork: true },
        ]);
      if (part === 'pulls')
        return Response.json({
          items: [
            {
              title: 'Add things',
              html_url: 'https://github.com/o/r/pull/4',
              number: 4,
              state: 'closed',
              repository_url: 'https://api.github.com/repos/o/r',
              created_at: '2026-10-01T00:00:00Z',
              pull_request: { merged_at: '2026-10-02T00:00:00Z' },
            },
            {
              title: 'WIP',
              html_url: 'https://github.com/o/r/pull/5',
              number: 5,
              state: 'open',
              draft: true,
              repository_url: 'https://api.github.com/repos/o/r',
              created_at: '2026-10-03T00:00:00Z',
            },
          ],
        });
      if (part === 'page') return new Response(PAGE, { headers: { 'Content-Type': 'text/html' } });
      throw new Error('unexpected');
    },
  });
}

test('/github merges the REST profile, repositories, pull requests and page', async () => {
  const services = profileServices({ down: new Set(), now: () => 1000 });
  const response = await handleRequest(new Request('https://api.test/github'), services);
  assert.equal(response.status, 200);
  const body = (await response.json()) as Profile;
  assert.equal(body.login, user);
  assert.equal(body.blog, 'example.com');
  // Forks count toward neither stars nor languages.
  assert.equal(body.stars, 6);
  assert.deepEqual(body.languages, [
    { name: 'TypeScript', repos: 2 },
    { name: 'Go', repos: 1 },
  ]);
  assert.deepEqual(
    body.pulls.map((pull) => [pull.state, pull.repo]),
    [
      ['merged', 'o/r'],
      ['draft', 'o/r'],
    ],
  );
  // The page's counts win over the REST API's.
  assert.equal(body.followers, 1200);
  assert.equal(body.page?.status?.message, 'trying to be DevOps engineer');
  // Badge images go through the media proxy like the avatar does.
  assert.match(body.page?.achievements[0].image ?? '', /^https:\/\/api\.test\/media\/github\//);
});

test('/github keeps the last good copy of a part that fails', async () => {
  let clock = 1000;
  const down = new Set<string>();
  const tasks: Promise<unknown>[] = [];
  const services = {
    ...profileServices({ down, now: () => clock }),
    background: (task: Promise<unknown>) => void tasks.push(task),
  };
  await handleRequest(new Request('https://api.test/github'), services);
  // Past the ttl, the page, repositories and search all fail; the REST user is up.
  clock += 2 * 3600 * 1000;
  down.add('page').add('repos').add('pulls');
  const stale = await handleRequest(new Request('https://api.test/github'), services);
  assert.equal(stale.status, 200);
  await Promise.all(tasks);
  assert.ok(tasks.length, 'a stale read starts a refresh');
  const stored = JSON.parse((await services.state.get(`github:/github:${user}`))!) as {
    updatedAt: number;
    data: Profile;
  };
  // The refresh landed, and every failed part kept its previous value.
  assert.equal(stored.updatedAt, clock);
  assert.equal(stored.data.stars, 6);
  assert.equal(stored.data.pulls.length, 2);
  assert.equal(stored.data.page?.readme, 'Hello I build things.');
  assert.equal(stored.data.followers, 1200);
});

test('/github still answers when only the REST profile is up', async () => {
  const services = profileServices({ down: new Set(['page', 'repos', 'pulls']), now: () => 1000 });
  const response = await handleRequest(new Request('https://api.test/github'), services);
  assert.equal(response.status, 200);
  const body = (await response.json()) as Profile;
  assert.equal(body.followers, 7);
  assert.equal(body.page, null);
  assert.deepEqual(body.pulls, []);
});

/** A repository as api.github.com lists it. */
const listed = (name: string, extra: Record<string, unknown> = {}) => ({
  full_name: `${user}/${name}`,
  language: 'TypeScript',
  stargazers_count: 0,
  pushed_at: '2026-01-01T00:00:00Z',
  ...extra,
});

function repoServices(calls: string[] = []) {
  return testServices({
    now: () => 1000,
    fetch: async (input) => {
      calls.push(String(input));
      return Response.json([
        listed('quiet', { pushed_at: '2026-03-01T00:00:00Z' }),
        listed('popular', { stargazers_count: 9, language: 'Go' }),
        listed('forked', { stargazers_count: 50, fork: true }),
        listed('old', { archived: true }),
      ]);
    },
  });
}

interface Repos {
  total: number;
  repos: { name: string }[];
}
const names = async (services: ReturnType<typeof testServices>, query = '') =>
  (
    (await (
      await handleRequest(new Request(`https://api.test/github/repos${query}`), services)
    ).json()) as Repos
  ).repos.map((repo) => repo.name);

test('/github/repos lists the repositories and applies its options', async () => {
  const calls: string[] = [];
  const services = repoServices(calls);
  // Own work first, most starred first; forks and archived repositories last.
  assert.deepEqual(await names(services), ['popular', 'quiet', 'forked', 'old']);
  assert.deepEqual(await names(services, '?sort=stars'), ['forked', 'popular', 'quiet', 'old']);
  assert.deepEqual(await names(services, '?sort=name&limit=2'), ['forked', 'old']);
  assert.deepEqual(await names(services, '?forks=0&archived=0'), ['popular', 'quiet']);
  assert.deepEqual(await names(services, '?language=go'), ['popular']);
  // Every variant is shaped from the one stored listing.
  assert.equal(calls.length, 1);
  const bad = await handleRequest(
    new Request('https://api.test/github/repos?sort=bogus'),
    services,
  );
  assert.equal(bad.status, 400);
});

test('/github/contributions takes a year and caches it apart from the last year', async () => {
  const calls: string[] = [];
  const services = testServices({
    now: () => Date.parse('2026-06-01T00:00:00Z'),
    fetch: async (input) => {
      const url = String(input);
      calls.push(url);
      const year = url.endsWith('y=2025') ? '2025' : '2026';
      return Response.json({ contributions: [{ date: `${year}-01-01`, count: 1, level: 1 }] });
    },
  });
  const read = async (query = '') =>
    (
      (await (
        await handleRequest(new Request(`https://api.test/github/contributions${query}`), services)
      ).json()) as { contributions: { date: string }[] }
    ).contributions[0].date;
  assert.equal(await read(), '2026-01-01');
  assert.equal(await read('?year=2025'), '2025-01-01');
  assert.equal(await read(), '2026-01-01');
  assert.deepEqual(
    calls.map((url) => url.split('?y=')[1]),
    ['last', '2025'],
  );
  for (const year of ['1999', '2027', 'abc']) {
    const response = await handleRequest(
      new Request(`https://api.test/github/contributions?year=${year}`),
      services,
    );
    assert.equal(response.status, 400, `${year} is not a year the route serves`);
  }
});
