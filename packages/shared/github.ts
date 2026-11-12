// How a GitHub profile card is built from api.github.com answers. The API uses
// this for its cached `/github` route; the site uses the same functions when
// the card is configured to ask GitHub directly from the visitor's browser, so
// both sources hand the card the same shape.

const MAX_LANGUAGES = 6;
export const MAX_PULLS = 5;

export interface GitHubRepo {
  language?: string | null;
  stargazers_count?: number | null;
  fork?: boolean | null;
}

export interface GitHubSearchItem {
  title: string;
  html_url: string;
  number: number;
  state: string;
  repository_url: string;
  created_at: string;
  draft?: boolean | null;
  pull_request?: { merged_at?: string | null } | null;
}

export type PullState = 'open' | 'draft' | 'merged' | 'closed';

export interface GitHubPull {
  title: string;
  url: string;
  repo: string;
  number: number;
  state: PullState;
  createdAt: string;
}

/** api.github.com paths for one account's card. */
export const githubPaths = {
  user: (username: string) => `/users/${encodeURIComponent(username)}`,
  repos: (username: string) =>
    `/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=pushed`,
  pulls: (username: string) =>
    `/search/issues?q=${encodeURIComponent(`author:${username} type:pr is:public`)}` +
    `&sort=created&order=desc&per_page=${MAX_PULLS}`,
};

/** Stars on the account's own repositories; forks carry someone else's. */
export const ownStars = (repos: GitHubRepo[]): number =>
  repos.reduce((sum, repo) => sum + (repo.fork ? 0 : (repo.stargazers_count ?? 0)), 0);

/** The account's most used languages, by number of its own repositories. */
export function repoLanguages(repos: GitHubRepo[]): { name: string; repos: number }[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.fork || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_LANGUAGES)
    .map(([name, count]) => ({ name, repos: count }));
}

function pullState(item: GitHubSearchItem): PullState {
  if (item.pull_request?.merged_at) return 'merged';
  if (item.state === 'open') return item.draft ? 'draft' : 'open';
  return 'closed';
}

/** Search results as the card lists them. */
export const recentPulls = (items: GitHubSearchItem[]): GitHubPull[] =>
  items.slice(0, MAX_PULLS).map((item) => ({
    title: item.title,
    url: item.html_url,
    repo: item.repository_url.replace(/^https:\/\/api\.github\.com\/repos\//, ''),
    number: item.number,
    state: pullState(item),
    createdAt: item.created_at,
  }));

export interface GitHubListedRepo extends GitHubRepo {
  name: string;
  html_url: string;
  description?: string | null;
  forks_count?: number | null;
  owner?: { login?: string } | null;
}

/**
 * Stand-ins for the pinned repositories, which only the profile page lists:
 * the account's own most starred repositories, most recently pushed first
 * among equals (the order the listing arrives in).
 */
export const popularRepos = (repos: GitHubListedRepo[], limit = 6) =>
  repos
    .filter((repo) => !repo.fork)
    .map((repo, index) => ({ repo, index }))
    .sort(
      (a, b) =>
        (b.repo.stargazers_count ?? 0) - (a.repo.stargazers_count ?? 0) || a.index - b.index,
    )
    .slice(0, limit)
    .map(({ repo }) => ({
      owner: repo.owner?.login ?? '',
      name: repo.name,
      url: repo.html_url,
      description: repo.description ?? null,
      language: repo.language ?? null,
      color: null,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      label: 'Public',
    }));
