// Where the GitHub card's data comes from.
//
// With `apiEndpoint` set in links.json the card reads this site's API: one
// cached answer that also carries what only the profile page shows (status,
// achievements, pinned repositories, README), and normally already in hand
// from the site-wide request. If the API is down the card falls back to the
// second source below, so it still renders.
//
// Without `apiEndpoint`, the visitor's browser asks GitHub itself and the API
// is never involved. api.github.com allows 60 anonymous requests an hour per
// address, so the answers are kept in localStorage for an hour and a revisit
// costs nothing (hooks/useCardSource.js). The profile page cannot be read
// cross-origin, so the pinned repositories come from a public service that
// reads it (the most starred repositories stand in when it is down) and the
// page-only extras are left out.
import { useMemo } from 'react';
import { githubPaths, ownStars, popularRepos, repoLanguages } from '@portfolio/shared/github';
import { apiUrl } from '../../../lib/api.js';
import { useCardSource } from '../../../hooks/useCardSource.js';
import { useCardFeed } from '../LinksFeed.jsx';

async function github(path, signal) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response.ok) throw new Error(`github ${response.status}`);
  return response.json();
}

// Pinned repositories in the card's shape. The service's star counts are
// unreliable, and the card does not show stars anyway.
async function pinnedRepos(username, signal) {
  const response = await fetch(
    `https://pinned.berrysauce.dev/get/${encodeURIComponent(username)}`,
    { signal },
  );
  if (!response.ok) throw new Error(`pinned ${response.status}`);
  const list = await response.json();
  if (!Array.isArray(list)) throw new Error('pinned: not a list');
  return list
    .filter((repo) => repo?.author && repo?.name)
    .map((repo) => ({
      owner: repo.author,
      name: repo.name,
      url: `https://github.com/${repo.author}/${repo.name}`,
      description: repo.description || null,
      language: repo.language || null,
      color: repo.languageColor || null,
      stars: 0,
      forks: Number(repo.forks) || 0,
      label: 'Public',
    }));
}

async function loadDirect(username, previous, signal) {
  const [user, repos, pins] = await Promise.allSettled([
    github(githubPaths.user(username), signal),
    github(githubPaths.repos(username), signal),
    pinnedRepos(username, signal),
  ]);
  if (user.status === 'rejected') throw user.reason;
  const repoList = repos.status === 'fulfilled' && Array.isArray(repos.value) ? repos.value : null;
  // A part that fails keeps what the last visit had for it.
  return {
    ...user.value,
    stars: repoList ? ownStars(repoList) : (previous?.stars ?? null),
    languages: repoList ? repoLanguages(repoList) : (previous?.languages ?? []),
    popular: repoList ? popularRepos(repoList) : (previous?.popular ?? []),
    pinned: pins.status === 'fulfilled' ? pins.value : (previous?.pinned ?? []),
    page: null,
  };
}

const hasLogin = (data) => Boolean(data?.login);

/**
 * `{ profile, direct, loading }` for the card; nothing is requested while
 * `enabled` is false. `api` says the card is configured to read this site's
 * API; GitHub itself is asked when it is not, or when the API fails. `direct`
 * tells the card its image URLs are GitHub's own rather than the API's.
 */
export function useGitHubProfile({ username, api, enabled }) {
  const direct = useMemo(
    () => (username ? (signal, previous) => loadDirect(username, previous, signal) : null),
    [username],
  );
  const { data, origin, loading } = useCardSource({
    api: api && username ? apiUrl(`/github?username=${encodeURIComponent(username)}`) : null,
    seed: useCardFeed('github'),
    direct,
    enabled,
    cacheKey: username ? `gh:direct:v3:${username}` : null,
    valid: hasLogin,
  });
  return { profile: data, direct: origin === 'direct', loading };
}
