// The projects page's content model, shared by the site (which renders
// content/projects/projects.json before any request) and the API (which fills
// in what the git hosts know). Keeping the parsing here means a card rendered
// from content alone and the one the API later returns agree on name and link.

export type GitHost = 'github' | 'codeberg' | 'gitlab';

export const GIT_HOSTS: Record<GitHost, { label: string; origin: string }> = {
  github: { label: 'GitHub', origin: 'https://github.com' },
  codeberg: { label: 'Codeberg', origin: 'https://codeberg.org' },
  gitlab: { label: 'GitLab', origin: 'https://gitlab.com' },
};

/** One card on the projects page, whichever source it came from. */
export interface Project {
  /** Stable React key and lookup id: `<host>:<owner>/<name>` or `manual:<name>`. */
  id: string;
  host: GitHost | null;
  name: string;
  description: string | null;
  /** Repository page. Null for a manual project without one. */
  repo: string | null;
  /** The project's own site: the repository's homepage field, or `url` in content. */
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  /** ISO timestamp of the last push or activity; null when unknown. */
  pushedAt: string | null;
  archived: boolean;
  fork: boolean;
}

/** A featured entry as written in content/projects/projects.json. */
export interface FeaturedEntry {
  repo?: string;
  name?: string;
  description?: string;
  url?: string;
  language?: string;
  tags?: string[];
}

export interface AccountEntry {
  host: string;
  username?: string;
}

export interface ProjectsContent {
  featured?: FeaturedEntry[];
  accounts?: AccountEntry[];
}

export interface RepoRef {
  host: GitHost;
  /** Owner, or the whole group path on GitLab (`group/subgroup`). */
  owner: string;
  name: string;
  url: string;
}

const HOST_BY_NAME: Record<string, GitHost> = {
  'github.com': 'github',
  'www.github.com': 'github',
  'codeberg.org': 'codeberg',
  'gitlab.com': 'gitlab',
  'www.gitlab.com': 'gitlab',
};

const SEGMENT = /^[A-Za-z0-9._-]+$/;

export const isGitHost = (value: unknown): value is GitHost =>
  typeof value === 'string' && Object.hasOwn(GIT_HOSTS, value);

/** A repository URL on one of the three supported hosts, or null. */
export function parseRepoUrl(source: unknown): RepoRef | null {
  if (typeof source !== 'string') return null;
  let url: URL;
  try {
    url = new URL(source.trim());
  } catch {
    return null;
  }
  const host = HOST_BY_NAME[url.hostname.toLowerCase()];
  if (!host || url.protocol !== 'https:') return null;
  const segments = url.pathname
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean);
  // Only GitLab nests groups; the other hosts are always owner/name.
  if (segments.length < 2 || (host !== 'gitlab' && segments.length !== 2)) return null;
  if (!segments.every((segment) => SEGMENT.test(segment))) return null;
  const name = segments[segments.length - 1];
  const owner = segments.slice(0, -1).join('/');
  return { host, owner, name, url: `${GIT_HOSTS[host].origin}/${owner}/${name}` };
}

export const repoId = (ref: Pick<RepoRef, 'host' | 'owner' | 'name'>) =>
  `${ref.host}:${ref.owner}/${ref.name}`.toLowerCase();

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** An http(s) link from content or a git host, or null — never another scheme. */
export function webUrl(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(source) ? source : `https://${source}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A featured card from its content entry, laid over whatever the git host
 * reported for that repository. Fields written in content always win, so the
 * card reads the same before and after the API answers, and a manual project
 * (no `repo`) needs no host at all. Returns null for an entry with nothing to
 * show.
 */
export function featuredProject(entry: FeaturedEntry, live?: Project | null): Project | null {
  const ref = parseRepoUrl(entry?.repo);
  const name = text(entry?.name) || live?.name || ref?.name;
  if (!name) return null;
  const tags = Array.isArray(entry.tags) ? entry.tags.map(text).filter((tag) => tag !== null) : [];
  return {
    id: ref ? repoId(ref) : `manual:${name.toLowerCase()}`,
    host: ref?.host ?? null,
    name,
    description: text(entry.description) || live?.description || null,
    repo: ref?.url ?? null,
    homepage: webUrl(entry.url) || live?.homepage || null,
    language: text(entry.language) || live?.language || null,
    stars: live?.stars ?? 0,
    forks: live?.forks ?? 0,
    topics: tags.length ? tags : (live?.topics ?? []),
    pushedAt: live?.pushedAt ?? null,
    archived: live?.archived ?? false,
    fork: live?.fork ?? false,
  };
}

/** The featured cards in the order content lists them. */
export function featuredProjects(
  content: ProjectsContent | null | undefined,
  lookup: (id: string) => Project | null | undefined = () => null,
): Project[] {
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const entry of Array.isArray(content?.featured) ? content.featured : []) {
    const ref = parseRepoUrl(entry?.repo);
    const project = featuredProject(entry, ref ? lookup(repoId(ref)) : null);
    if (!project || seen.has(project.id)) continue;
    seen.add(project.id);
    out.push(project);
  }
  return out;
}

/** The accounts to list, in content order, skipping blanks and unknown hosts. */
export function projectAccounts(
  content: ProjectsContent | null | undefined,
): { host: GitHost; username: string; url: string }[] {
  const seen = new Set<string>();
  const out: { host: GitHost; username: string; url: string }[] = [];
  for (const account of Array.isArray(content?.accounts) ? content.accounts : []) {
    const username = text(account?.username)?.replace(/^@/, '');
    if (!isGitHost(account?.host) || !username || !SEGMENT.test(username)) continue;
    if (seen.has(account.host)) continue;
    seen.add(account.host);
    out.push({
      host: account.host,
      username,
      url: `${GIT_HOSTS[account.host].origin}/${username}`,
    });
  }
  return out;
}

/* ── git host payloads ──
 * How each host's repository JSON becomes a Project. The API applies these to
 * what it fetched and validated; the site applies the same ones when it lists
 * a host straight from the visitor's browser because the API is unreachable. */

/** A listed repository always has a host and a page. */
export type Repo = Project & { host: GitHost; repo: string };

export interface GitHubRepoPayload {
  full_name: string;
  description?: string | null;
  homepage?: string | null;
  language?: string | null;
  stargazers_count?: number | null;
  forks_count?: number | null;
  topics?: string[] | null;
  pushed_at?: string | null;
  archived?: boolean | null;
  fork?: boolean | null;
}
/** Forgejo, which Codeberg runs. */
export interface CodebergRepoPayload {
  full_name: string;
  description?: string | null;
  website?: string | null;
  language?: string | null;
  stars_count?: number | null;
  forks_count?: number | null;
  topics?: string[] | null;
  updated_at?: string | null;
  archived?: boolean | null;
  fork?: boolean | null;
}
export interface GitLabRepoPayload {
  path_with_namespace: string;
  description?: string | null;
  star_count?: number | null;
  forks_count?: number | null;
  topics?: string[] | null;
  last_activity_at?: string | null;
  archived?: boolean | null;
  forked_from_project?: unknown;
}

const MAX_DESCRIPTION = 300;
const MAX_TOPICS = 8;

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
  const ref = parseRepoUrl(`${GIT_HOSTS[host].origin}/${fullName}`);
  if (!ref) return null;
  const pushed = fields.pushedAt ? Date.parse(fields.pushedAt) : NaN;
  return {
    id: repoId(ref),
    host,
    name: ref.name,
    description: fields.description?.trim().slice(0, MAX_DESCRIPTION) || null,
    repo: ref.url,
    homepage: webUrl(fields.homepage),
    language: fields.language?.trim() || null,
    stars: fields.stars ?? 0,
    forks: fields.forks ?? 0,
    topics: (fields.topics || []).slice(0, MAX_TOPICS),
    pushedAt: Number.isNaN(pushed) ? null : new Date(pushed).toISOString(),
    archived: fields.archived ?? false,
    fork: fields.fork ?? false,
  };
}

export const fromGitHub = (repo: GitHubRepoPayload) =>
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
export const fromCodeberg = (repo: CodebergRepoPayload) =>
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
export const fromGitLab = (repo: GitLabRepoPayload) =>
  normalize('gitlab', repo.path_with_namespace, {
    description: repo.description,
    stars: repo.star_count,
    forks: repo.forks_count,
    topics: repo.topics,
    pushedAt: repo.last_activity_at,
    archived: repo.archived,
    fork: Boolean(repo.forked_from_project),
  });

/** One host payload as a Project, whichever host it came from. */
export const fromHost = (host: GitHost, payload: unknown): Repo | null =>
  host === 'github'
    ? fromGitHub(payload as GitHubRepoPayload)
    : host === 'codeberg'
      ? fromCodeberg(payload as CodebergRepoPayload)
      : fromGitLab(payload as GitLabRepoPayload);

/** Every public repository of one account: one request, the first 100 (50 on Codeberg). */
export function listReposUrl(host: GitHost, username: string): string {
  const user = encodeURIComponent(username);
  if (host === 'github')
    return `https://api.github.com/users/${user}/repos?type=owner&sort=pushed&per_page=100`;
  if (host === 'codeberg') return `https://codeberg.org/api/v1/users/${user}/repos?limit=50`;
  return `https://gitlab.com/api/v4/users/${user}/projects?visibility=public&order_by=last_activity_at&per_page=100`;
}

/** One repository by reference. */
export function repoApiUrl(ref: RepoRef): string {
  const path = `${ref.owner.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(ref.name)}`;
  if (ref.host === 'github') return `https://api.github.com/repos/${path}`;
  if (ref.host === 'codeberg') return `https://codeberg.org/api/v1/repos/${path}`;
  return `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${ref.owner}/${ref.name}`)}`;
}

/** Own work first, then by stars, then by most recent push. */
export function byInterest(a: Project, b: Project): number {
  const shelved = (repo: Project) => Number(repo.fork || repo.archived);
  return (
    shelved(a) - shelved(b) ||
    b.stars - a.stars ||
    (b.pushedAt || '').localeCompare(a.pushedAt || '')
  );
}
