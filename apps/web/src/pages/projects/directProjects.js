// The projects listing straight from the git hosts, for when this site's API
// cannot be reached. GitHub, Codeberg and GitLab all answer their public
// repository APIs cross-origin, and @portfolio/shared/projects holds the same
// mappers the API uses, so the page gets the shape `/projects` would have sent.
import {
  byInterest,
  fromHost,
  listReposUrl,
  parseRepoUrl,
  projectAccounts,
  repoApiUrl,
  repoId,
} from '@portfolio/shared/projects';

const TIMEOUT_MS = 10000;

async function getJSON(url, signal) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`);
  return response.json();
}

/** `{ updatedAt, featured, sections, unavailable }`; throws when no host answered. */
export async function loadProjectsDirect(content) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const accounts = projectAccounts(content);
  const listings = await Promise.all(
    accounts.map(async (account) => {
      try {
        const list = await getJSON(listReposUrl(account.host, account.username), signal);
        const repos = (Array.isArray(list) ? list : [])
          .map((repo) => fromHost(account.host, repo))
          .filter(Boolean)
          .sort(byInterest);
        return { ...account, repos };
      } catch {
        return { ...account, repos: null };
      }
    }),
  );
  const sections = listings.filter((listing) => listing.repos);
  const down = listings.filter((listing) => !listing.repos);

  // Featured repositories no listed account owns cost a request each; one
  // whose host just failed is not asked for again.
  const listed = new Set(sections.flatMap((section) => section.repos.map((repo) => repo.id)));
  const refs = (Array.isArray(content?.featured) ? content.featured : [])
    .map((entry) => parseRepoUrl(entry?.repo))
    .filter((ref) => ref && !listed.has(repoId(ref)))
    .filter((ref) => !down.some((account) => account.host === ref.host));
  const extra = (
    await Promise.all(
      refs.map((ref) =>
        getJSON(repoApiUrl(ref), signal)
          .then((repo) => fromHost(ref.host, repo))
          .catch(() => null),
      ),
    )
  ).filter(Boolean);

  if (!sections.length && !extra.length) throw new Error('no git host answered');
  return {
    updatedAt: new Date().toISOString(),
    // The page lays content over these by id, so only the extras are needed.
    featured: extra,
    sections: sections.filter((section) => section.repos.length),
    unavailable: down.map(({ host, username, url }) => ({ host, username, url })),
  };
}
