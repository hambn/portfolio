import { z } from 'zod';
import {
  featuredProjects,
  parseRepoUrl,
  projectAccounts,
  repoId,
  webUrl,
  type GitHost,
  type Project,
  type RepoRef,
} from '@portfolio/shared/projects';
import { projectsContent } from '../identities.js';
import type { Services } from '../contracts.js';
import { fetchWithTimeout, json, readJSON } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import {
  readPersisted,
  refreshPersisted,
  remainingTtl,
  type PersistedSource,
} from '../lib/persisted.js';
import { MINUTE, PROJECTS_RESPONSE_TTL, PROJECTS_RETRY_TTL, PROJECTS_TTL } from '../lib/ttl.js';
import { githubHeaders } from './github.js';

// Everything the projects page shows, in one response. Which repositories and
// which accounts is content (content/projects/projects.json), never a request
// parameter. What the git hosts report about them is kept in persistent state
// and refreshed hourly, so the page is answered from the API's own copy and a
// slow or rate-limited host never sits in front of a visitor.

const accounts = projectAccounts(projectsContent);
// Featured repositories, in content order. Those owned by a listed account are
// read out of that account's listing; only the rest cost a request each.
const featuredRefs = (projectsContent.featured || [])
  .map((entry) => parseRepoUrl(entry?.repo))
  .filter((ref) => ref !== null);

const projectSchema = z.object({
  id: z.string(),
  host: z.enum(['github', 'codeberg', 'gitlab']),
  name: z.string(),
  description: z.string().nullable(),
  repo: z.string(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  topics: z.array(z.string()),
  pushedAt: z.string().nullable(),
  archived: z.boolean(),
  fork: z.boolean(),
});
const sectionSchema = z.object({
  host: z.enum(['github', 'codeberg', 'gitlab']),
  username: z.string(),
  url: z.string(),
  repos: z.array(projectSchema),
});
const snapshotSchema = z.object({
  sections: z.array(sectionSchema),
  // Featured repositories that no listed account owns.
  extra: z.array(projectSchema),
  // Accounts (`host:username`) that failed with no earlier listing to keep.
  // While any are missing the snapshot is retried within minutes.
  missing: z.array(z.string()).default([]),
});
type Snapshot = z.infer<typeof snapshotSchema>;
type Repo = z.infer<typeof projectSchema>;
type Section = z.infer<typeof sectionSchema>;

/* ── host payloads ── */

const optionalText = z.string().nullish();
const count = z.number().nullish();
const flag = z.boolean().nullish();
const tags = z.array(z.string()).nullish();

const githubRepo = z.looseObject({
  full_name: z.string(),
  description: optionalText,
  homepage: optionalText,
  language: optionalText,
  stargazers_count: count,
  forks_count: count,
  topics: tags,
  pushed_at: optionalText,
  archived: flag,
  fork: flag,
});
// Forgejo, which Codeberg runs.
const codebergRepo = z.looseObject({
  full_name: z.string(),
  description: optionalText,
  website: optionalText,
  language: optionalText,
  stars_count: count,
  forks_count: count,
  topics: tags,
  updated_at: optionalText,
  archived: flag,
  fork: flag,
});
const gitlabRepo = z.looseObject({
  path_with_namespace: z.string(),
  description: optionalText,
  star_count: count,
  forks_count: count,
  topics: tags,
  last_activity_at: optionalText,
  archived: flag,
  forked_from_project: z.unknown().optional(),
});

const MAX_DESCRIPTION = 300;

function normalize(
  host: GitHost,
  fullName: string,
  fields: {
    description?: string | null;
    homepage?: string | null;
    language?: string | null;
    stars?: number | null;
    forks?: number | null;
    topics?: string[] | null;
    pushedAt?: string | null;
    archived?: boolean | null;
    fork?: boolean;
  },
): Repo | null {
  const ref = parseRepoUrl(`https://${HOSTNAME[host]}/${fullName}`);
  if (!ref) return null;
  const description = fields.description?.trim().slice(0, MAX_DESCRIPTION) || null;
  const pushed = fields.pushedAt ? Date.parse(fields.pushedAt) : NaN;
  return {
    id: repoId(ref),
    host,
    name: ref.name,
    description,
    repo: ref.url,
    homepage: webUrl(fields.homepage),
    language: fields.language?.trim() || null,
    stars: fields.stars ?? 0,
    forks: fields.forks ?? 0,
    topics: (fields.topics || []).slice(0, 8),
    pushedAt: Number.isNaN(pushed) ? null : new Date(pushed).toISOString(),
    archived: fields.archived ?? false,
    fork: fields.fork ?? false,
  };
}

const HOSTNAME: Record<GitHost, string> = {
  github: 'github.com',
  codeberg: 'codeberg.org',
  gitlab: 'gitlab.com',
};

const fromGitHub = (repo: z.infer<typeof githubRepo>) =>
  normalize('github', repo.full_name, {
    description: repo.description,
    homepage: repo.homepage,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: repo.topics,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
    fork: repo.fork ?? false,
  });
const fromCodeberg = (repo: z.infer<typeof codebergRepo>) =>
  normalize('codeberg', repo.full_name, {
    description: repo.description,
    homepage: repo.website,
    language: repo.language,
    stars: repo.stars_count,
    forks: repo.forks_count,
    topics: repo.topics,
    pushedAt: repo.updated_at,
    archived: repo.archived,
    fork: repo.fork ?? false,
  });
// GitLab's listing carries no language and no homepage field.
const fromGitLab = (repo: z.infer<typeof gitlabRepo>) =>
  normalize('gitlab', repo.path_with_namespace, {
    description: repo.description,
    stars: repo.star_count,
    forks: repo.forks_count,
    topics: repo.topics,
    pushedAt: repo.last_activity_at,
    archived: repo.archived,
    fork: Boolean(repo.forked_from_project),
  });

const present = (repo: Repo | null): repo is Repo => repo !== null;
const plainHeaders = { 'User-Agent': 'portfolio-api', Accept: 'application/json' };
const TIMEOUT_MS = 8000;

async function get<T extends z.ZodType>(
  services: Services,
  url: string,
  schema: T,
  headers: Record<string, string> = plainHeaders,
): Promise<z.output<T>> {
  const response = await fetchWithTimeout(services, url, { headers }, TIMEOUT_MS);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${new URL(url).hostname}_${response.status}`);
  }
  return readJSON(response, schema);
}

/** Every public repository of one account. One request; the first 100 (50 on Codeberg). */
async function listRepos(services: Services, host: GitHost, username: string): Promise<Repo[]> {
  const user = encodeURIComponent(username);
  if (host === 'github')
    return (
      await get(
        services,
        `https://api.github.com/users/${user}/repos?type=owner&sort=pushed&per_page=100`,
        z.array(githubRepo),
        githubHeaders(services),
      )
    )
      .map(fromGitHub)
      .filter(present);
  if (host === 'codeberg')
    return (
      await get(
        services,
        `https://codeberg.org/api/v1/users/${user}/repos?limit=50`,
        z.array(codebergRepo),
      )
    )
      .map(fromCodeberg)
      .filter(present);
  return (
    await get(
      services,
      `https://gitlab.com/api/v4/users/${user}/projects?visibility=public&order_by=last_activity_at&per_page=100`,
      z.array(gitlabRepo),
    )
  )
    .map(fromGitLab)
    .filter(present);
}

async function getRepo(services: Services, ref: RepoRef): Promise<Repo | null> {
  const path = `${ref.owner.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(ref.name)}`;
  if (ref.host === 'github')
    return fromGitHub(
      await get(
        services,
        `https://api.github.com/repos/${path}`,
        githubRepo,
        githubHeaders(services),
      ),
    );
  if (ref.host === 'codeberg')
    return fromCodeberg(
      await get(services, `https://codeberg.org/api/v1/repos/${path}`, codebergRepo),
    );
  return fromGitLab(
    await get(
      services,
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${ref.owner}/${ref.name}`)}`,
      gitlabRepo,
    ),
  );
}

/** Own work first, then by stars, then by most recent push. */
function byInterest(a: Repo, b: Repo): number {
  const shelved = (repo: Repo) => Number(repo.fork || repo.archived);
  return (
    shelved(a) - shelved(b) ||
    b.stars - a.stars ||
    (b.pushedAt || '').localeCompare(a.pushedAt || '')
  );
}

async function load(services: Services, previous: Snapshot | null): Promise<Snapshot> {
  let requests = 0;
  let failures = 0;
  const failed = (what: string, error: unknown) => {
    failures++;
    console.warn('Projects source failed', what, error instanceof Error ? error.message : '');
  };

  // A host that fails keeps the section it had; one bad host never empties
  // the others, and never empties itself.
  const unanswered = new Set<string>();
  const missing: string[] = [];
  const sections = await Promise.all(
    accounts.map(async ({ host, username, url }): Promise<Section> => {
      requests++;
      try {
        const repos = (await listRepos(services, host, username)).sort(byInterest);
        return { host, username, url, repos };
      } catch (error) {
        failed(`${host}:${username}`, error);
        unanswered.add(`${host}:${username}`.toLowerCase());
        const kept = previous?.sections.find(
          (section) => section.host === host && section.username === username,
        );
        // An empty section stored by an earlier failure is not a listing.
        const key = accountKey({ host, username });
        if (!kept || previous?.missing.includes(key)) missing.push(key);
        return { host, username, url, repos: kept?.repos ?? [] };
      }
    }),
  );

  const listed = new Set(sections.flatMap((section) => section.repos.map((repo) => repo.id)));
  const known = new Map(
    [...(previous?.extra ?? []), ...(previous?.sections ?? []).flatMap((s) => s.repos)].map(
      (repo) => [repo.id, repo],
    ),
  );
  const extra = (
    await Promise.all(
      featuredRefs
        .filter((ref) => !listed.has(repoId(ref)))
        .map(async (ref) => {
          // Its owner's listing just failed, so the host is down or rate
          // limiting: asking again per repository would only dig deeper.
          if (unanswered.has(`${ref.host}:${ref.owner}`.toLowerCase()))
            return known.get(repoId(ref)) ?? null;
          requests++;
          try {
            return await getRepo(services, ref);
          } catch (error) {
            failed(repoId(ref), error);
            return known.get(repoId(ref)) ?? null;
          }
        }),
    )
  ).filter(present);

  // Nothing answered: keep the stored snapshot and its timestamp as they are.
  if (requests > 0 && failures === requests) throw new Error('projects_sources_unavailable');
  return { sections, extra, missing };
}

const accountKey = (account: { host: GitHost; username: string }) =>
  `${account.host}:${account.username}`;

const source = (services: Services): PersistedSource<typeof snapshotSchema> => ({
  key: 'projects:snapshot',
  ttl: PROJECTS_TTL,
  ttlFor: (data) => (data.missing.length ? PROJECTS_RETRY_TTL : PROJECTS_TTL),
  schema: snapshotSchema,
  // An edit to the featured list or the accounts is fetched on the next
  // request after the deploy instead of waiting out the hour.
  version: JSON.stringify([
    accounts.map((a) => `${a.host}:${a.username}`),
    featuredRefs.map(repoId),
  ]),
  load: (previous) => load(services, previous),
});

/** Hourly, from the scheduler: refresh without waiting for a visitor. */
export async function refreshProjects(services: Services): Promise<void> {
  if (!accounts.length && !featuredRefs.length) return;
  await refreshPersisted(services, source(services));
}

export async function handle(request: Request, services: Services): Promise<Response> {
  return withCache(services, request, async () => {
    const value = await readPersisted(services, source(services));
    const repos = new Map(
      [...(value?.data.extra ?? []), ...(value?.data.sections ?? []).flatMap((s) => s.repos)].map(
        (repo): [string, Project] => [repo.id, repo],
      ),
    );
    const body = {
      // Null until the hosts have answered once; the featured cards below are
      // still complete as far as content describes them.
      updatedAt: value ? new Date(value.updatedAt).toISOString() : null,
      // Content decides which cards and in what order; the snapshot only adds
      // what the hosts know about them.
      featured: featuredProjects(projectsContent, (id) => repos.get(id)),
      // A host with nothing to show is left out rather than sent empty.
      sections: (value?.data.sections ?? []).filter((section) => section.repos.length),
      // Accounts whose host has not answered yet, so the page can say so and
      // link there instead of quietly leaving the host out.
      unavailable: accounts
        .filter((account) => !value || value.data.missing.includes(accountKey(account)))
        .map(({ host, username, url }) => ({ host, username, url })),
    };
    const ttl = !value
      ? 0
      : value.data.missing.length
        ? MINUTE
        : Math.min(PROJECTS_RESPONSE_TTL, remainingTtl(services, value, value.ttl));
    return json(body, 200, ttl);
  });
}
