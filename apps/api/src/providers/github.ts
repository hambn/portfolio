import { z } from 'zod';
import { identities } from '../identities.js';
import type { Services } from '../contracts.js';
import {
  fetchAllowed,
  fetchWithTimeout,
  readBytes,
  readJSON,
  json,
  expectOk,
} from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { persistedResponse, readPersisted } from '../lib/persisted.js';
import { PROFILE_TTL } from '../lib/ttl.js';
import { githubPaths, ownStars, recentPulls, repoLanguages } from '@portfolio/shared/github';
import { byInterest, fromGitHub, type Project } from '@portfolio/shared/projects';
import { githubPageSchema, parseGitHubPage, type GitHubPage } from './github-page.js';

const contributions = z.looseObject({
  contributions: z.array(
    z.object({ date: z.string(), count: z.number(), level: z.number().min(0).max(4) }),
  ),
});

const text = z.string().nullish();
const user = z.looseObject({
  login: z.string(),
  avatar_url: z.string(),
  name: text,
  bio: text,
  blog: text,
  location: text,
  company: text,
  twitter_username: text,
  created_at: text,
  public_repos: z.number().nullish(),
  followers: z.number().nullish(),
  following: z.number().nullish(),
});
const repos = z.array(
  z.looseObject({
    language: text,
    stargazers_count: z.number().nullish(),
    fork: z.boolean().nullish(),
  }),
);
const pulls = z.looseObject({
  items: z.array(
    z.looseObject({
      title: z.string(),
      html_url: z.string(),
      number: z.number(),
      state: z.string(),
      repository_url: z.string(),
      created_at: z.string(),
      draft: z.boolean().nullish(),
      pull_request: z.looseObject({ merged_at: text }).nullish(),
    }),
  ),
});

const pullSchema = z.object({
  title: z.string(),
  url: z.string(),
  repo: z.string(),
  number: z.number(),
  state: z.enum(['open', 'draft', 'merged', 'closed']),
  createdAt: z.string(),
});
const languageSchema = z.object({ name: z.string(), repos: z.number() });

// The card's whole answer. Everything past the REST profile is optional and
// defaults, so a value stored before a field existed still parses and can be
// served while the new shape loads.
const profile = user.extend({
  stars: z.number().nullish(),
  languages: z.array(languageSchema).default([]),
  pulls: z.array(pullSchema).default([]),
  page: githubPageSchema.nullish(),
});
type Profile = z.output<typeof profile>;

// Bump when the stored shape gains a field, so a stored value is refreshed
// before it is served.
const PROFILE_VERSION = 'profile-2';
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Headers for api.github.com. Anonymous calls share a 60/hour budget per
 * address, which a Worker shares with every other Worker on that address; an
 * optional read-only GITHUB_TOKEN lifts it to 5000/hour.
 */
export function githubHeaders(services: Services): Record<string, string> {
  return {
    'User-Agent': 'portfolio-api',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(services.config.GITHUB_TOKEN
      ? { Authorization: `Bearer ${services.config.GITHUB_TOKEN}` }
      : {}),
  };
}

async function api<T extends z.ZodType>(services: Services, path: string, schema: T) {
  const response = await fetchWithTimeout(services, `https://api.github.com${path}`, {
    headers: githubHeaders(services),
  });
  await expectOk(response, `github_${response.status}`);
  return readJSON(response, schema);
}

/** The signed-out profile page, for what only the page shows. */
async function page(services: Services, username: string): Promise<GitHubPage> {
  const response = await fetchAllowed(
    services,
    `https://github.com/${encodeURIComponent(username)}`,
    (url) => url.startsWith('https://github.com/'),
    { headers: { 'User-Agent': 'portfolio-api', Accept: 'text/html' } },
  );
  await expectOk(response, `github_page_${response.status}`);
  const bytes = await readBytes(response, MAX_PAGE_BYTES);
  if (!bytes) throw new Error('github_page_too_large');
  const parsed = parseGitHubPage(new TextDecoder().decode(bytes));
  if (!parsed) throw new Error('github_page_unrecognised');
  return parsed;
}

const settled = <T>(result: PromiseSettledResult<T>, label: string): T | undefined => {
  if (result.status === 'fulfilled') return result.value;
  const reason = result.reason instanceof Error ? result.reason.message : 'unknown';
  console.warn('GitHub part failed', label, reason);
  return undefined;
};

/**
 * One profile from four sources: the REST user (required), the user's
 * repositories, their latest public pull requests and the profile page. A
 * part that fails keeps what the previous load had for it.
 */
async function loadProfile(
  services: Services,
  username: string,
  previous: Profile | null,
): Promise<Profile> {
  const [userResult, reposResult, pullsResult, pageResult] = await Promise.allSettled([
    api(services, githubPaths.user(username), user),
    api(services, githubPaths.repos(username), repos),
    api(services, githubPaths.pulls(username), pulls),
    page(services, username),
  ]);
  if (userResult.status === 'rejected') throw userResult.reason;
  const rest = userResult.value;
  const repoList = settled(reposResult, 'repos');
  const pullList = settled(pullsResult, 'pulls');
  const pageData = settled(pageResult, 'page') ?? previous?.page ?? null;
  return {
    login: rest.login,
    avatar_url: rest.avatar_url,
    name: rest.name ?? null,
    bio: rest.bio ?? null,
    blog: rest.blog || null,
    location: rest.location ?? null,
    company: rest.company ?? null,
    twitter_username: rest.twitter_username ?? null,
    created_at: rest.created_at ?? null,
    public_repos: rest.public_repos ?? null,
    // The page is not behind the REST API's cache, so its counts are fresher.
    followers: pageData?.followers ?? rest.followers ?? null,
    following: pageData?.following ?? rest.following ?? null,
    stars: repoList ? ownStars(repoList) : (previous?.stars ?? null),
    languages: repoList ? repoLanguages(repoList) : (previous?.languages ?? []),
    pulls: pullList ? recentPulls(pullList.items) : (previous?.pulls ?? []),
    page: pageData,
  };
}

const githubRepo = z.looseObject({
  full_name: z.string(),
  description: text,
  homepage: text,
  language: text,
  stargazers_count: z.number().nullish(),
  forks_count: z.number().nullish(),
  topics: z.array(z.string()).nullish(),
  pushed_at: text,
  archived: z.boolean().nullish(),
  fork: z.boolean().nullish(),
});

const REPO_SORTS = {
  interest: byInterest,
  stars: (a: Project, b: Project) => b.stars - a.stars || byInterest(a, b),
  pushed: (a: Project, b: Project) => (b.pushedAt || '').localeCompare(a.pushedAt || ''),
  name: (a: Project, b: Project) => a.name.localeCompare(b.name),
} as const;
const isRepoSort = (value: string): value is keyof typeof REPO_SORTS =>
  Object.hasOwn(REPO_SORTS, value);

const FIRST_YEAR = 2008;

/** `/github/contributions`: the last year, or one calendar year with `?year=`. */
async function contributionsRoute(request: Request, services: Services, username: string) {
  const year = new URL(request.url).searchParams.get('year');
  const thisYear = new Date(services.now()).getUTCFullYear();
  if (year !== null && !(/^\d{4}$/.test(year) && +year >= FIRST_YEAR && +year <= thisYear))
    return json({ error: 'github_year_invalid' }, 400);
  const span = year ?? 'last';
  // The cache key ignores the query string, so the year goes into its path.
  const cachePath = year ? `/github/contributions/${year}` : undefined;
  return withCache(
    services,
    request,
    async () => {
      // Kept in state as well as the response cache: once a card has loaded, a
      // GitHub outage or rate limit serves the last good copy instead of a 502.
      const value = await readPersisted(services, {
        key: `github:/github/contributions:${username}${year ? `:${year}` : ''}`,
        ttl: PROFILE_TTL,
        schema: contributions,
        load: async () => {
          const response = await fetchWithTimeout(
            services,
            `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=${span}`,
            { headers: { 'User-Agent': 'portfolio-api', Accept: 'application/json' } },
          );
          await expectOk(response, `github_${response.status}`);
          return readJSON(response, contributions);
        },
      });
      return persistedResponse(services, value, PROFILE_TTL, 'github_unavailable');
    },
    cachePath,
  );
}

/**
 * `/github/repos`: the account's public repositories in the projects page's
 * shape. `sort` is interest (default), stars, pushed or name; `forks=0` and
 * `archived=0` leave those out; `language` keeps one language; `limit` caps
 * the list.
 */
async function reposRoute(request: Request, services: Services, username: string) {
  const params = new URL(request.url).searchParams;
  const sort = params.get('sort') || 'interest';
  if (!isRepoSort(sort)) return json({ error: 'github_sort_invalid' }, 400);
  const limit = Math.min(100, Math.max(0, Math.floor(Number(params.get('limit')) || 0)));
  const forks = params.get('forks') !== '0';
  const archived = params.get('archived') !== '0';
  const language = params.get('language')?.toLowerCase() || '';
  const variant = [sort, limit, +forks, +archived, encodeURIComponent(language)].join('-');
  return withCache(
    services,
    request,
    async () => {
      const value = await readPersisted(services, {
        key: `github:/github/repos:${username}`,
        ttl: PROFILE_TTL,
        schema: z.array(githubRepo),
        load: () => api(services, githubPaths.repos(username), z.array(githubRepo)),
      });
      if (!value) return json({ error: 'github_unavailable' }, 502);
      const repos = value.data
        .map(fromGitHub)
        .filter((repo) => repo !== null)
        .filter(
          (repo) =>
            (forks || !repo.fork) &&
            (archived || !repo.archived) &&
            (!language || repo.language?.toLowerCase() === language),
        )
        .sort(REPO_SORTS[sort]);
      return persistedResponse(
        services,
        {
          ...value,
          data: {
            updatedAt: new Date(value.updatedAt).toISOString(),
            total: repos.length,
            repos: limit ? repos.slice(0, limit) : repos,
          },
        },
        PROFILE_TTL,
        'github_unavailable',
      );
    },
    `/github/repos/${variant}`,
  );
}

export async function handle(request: Request, services: Services) {
  const url = new URL(request.url);
  const username = url.searchParams.get('username') || identities.github;
  if (username !== identities.github) return json({ error: 'github_username_not_configured' }, 400);
  // routes.ts only dispatches /github and its two sub-routes here.
  if (url.pathname === '/github/contributions')
    return contributionsRoute(request, services, username);
  if (url.pathname === '/github/repos') return reposRoute(request, services, username);
  return withCache(services, request, async () => {
    const value = await readPersisted(services, {
      key: `github:/github:${username}`,
      ttl: PROFILE_TTL,
      schema: profile,
      version: PROFILE_VERSION,
      load: (previous) => loadProfile(services, username, previous),
    });
    return persistedResponse(services, value, PROFILE_TTL, 'github_unavailable');
  });
}
