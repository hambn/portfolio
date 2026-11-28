// Shared directory of configured social/contact link services.
// Pure JS (no JSX or browser APIs) so prerender.mjs, Links.jsx, Terminal.jsx,
// and tests all read from the exact same mapping of content/links/links.json.

/**
 * Build the ordered list of configured link services from content/links/links.json.
 * Every service gets a shareable route (`/links/<slug>/`) with its own Discord/OG
 * embed card and (for external URLs) instant redirect to the target profile.
 */
export function buildLinkServices(config = {}, profile = {}) {
  const defaultHandle = profile?.handle || 'hambn';
  const list = [
    config.email?.address && {
      slug: 'email',
      cardId: 'email',
      label: 'Email',
      accent: '#ea4335',
      handle: config.email.address,
      url: `mailto:${config.email.address}`,
      redirect: false,
      tagline: `Email ${profile?.name || defaultHandle} directly or use the contact form.`,
    },
    config.discord?.userId && {
      slug: 'discord',
      cardId: 'dc',
      label: 'Discord',
      accent: '#5865f2',
      handle: `@${defaultHandle}`,
      url: `https://discord.com/users/${config.discord.userId}`,
      redirect: true,
      tagline: `Connect with ${profile?.name || defaultHandle} on Discord.`,
    },
    config.telegram && {
      slug: 'telegram',
      cardId: 'tg',
      label: 'Telegram',
      accent: '#2aabee',
      handle: `@${config.telegram.handle || config.telegram.username || defaultHandle}`,
      url:
        config.telegram.url ||
        `https://t.me/${config.telegram.handle || config.telegram.username || defaultHandle}`,
      redirect: true,
      tagline: `Message ${profile?.name || defaultHandle} on Telegram.`,
    },
    config.x && {
      slug: 'x',
      cardId: 'x',
      label: 'X',
      accent: '#e4e4e7',
      handle: `@${config.x.handle || defaultHandle}`,
      url: config.x.url || `https://x.com/${config.x.handle || defaultHandle}`,
      redirect: true,
      tagline: `Follow ${profile?.name || defaultHandle} on X.`,
    },
    config.github && {
      slug: 'github',
      cardId: 'gh',
      label: 'GitHub',
      accent: '#3b82f6',
      handle: `@${config.github.username || defaultHandle}`,
      url: config.github.url || `https://github.com/${config.github.username || defaultHandle}`,
      redirect: true,
      tagline: `Repositories, infrastructure tooling, and open source by ${profile?.name || defaultHandle}.`,
    },
    config.gitlab && {
      slug: 'gitlab',
      cardId: 'gl',
      label: 'GitLab',
      accent: '#fc6d26',
      handle: `@${config.gitlab.username || defaultHandle}`,
      url: config.gitlab.url || `https://gitlab.com/${config.gitlab.username || defaultHandle}`,
      redirect: true,
      tagline: `GitLab repositories and CI/CD projects by ${profile?.name || defaultHandle}.`,
    },
    config.linkedin && {
      slug: 'linkedin',
      cardId: 'li',
      label: 'LinkedIn',
      accent: '#0a66c2',
      handle: `in/${config.linkedin.handle || defaultHandle}`,
      url:
        config.linkedin.url ||
        `https://www.linkedin.com/in/${config.linkedin.handle || defaultHandle}/`,
      redirect: true,
      tagline: `Professional profile and work history for ${profile?.name || defaultHandle}.`,
    },
    config.spotify?.userId && {
      slug: 'spotify',
      cardId: 'sp',
      label: 'Spotify',
      accent: '#1ed760',
      handle: `@${defaultHandle}`,
      url: `https://open.spotify.com/user/${config.spotify.userId}`,
      redirect: true,
      tagline: `Playlists and music activity from ${profile?.name || defaultHandle} on Spotify.`,
    },
    config.steam && {
      slug: 'steam',
      cardId: 'st',
      label: 'Steam',
      accent: '#66c0f4',
      handle: config.steam.handle || defaultHandle,
      url:
        config.steam.url ||
        `https://steamcommunity.com/id/${config.steam.handle || defaultHandle}/`,
      redirect: true,
      tagline: `Games and Steam community profile for ${profile?.name || defaultHandle}.`,
    },
  ];
  return list.filter(Boolean);
}

/** Look up a single service by its route slug (e.g. "discord", "github"). */
export function findLinkService(config, slug, profile) {
  const needle = String(slug || '')
    .trim()
    .toLowerCase();
  if (!needle) return null;
  return buildLinkServices(config, profile).find((item) => item.slug === needle) || null;
}

/** Canonical shareable URL on this site for a link service. */
export const linkShareUrl = (slug, siteRoot) =>
  `${String(siteRoot || '').replace(/\/+$/, '')}/links/${slug}/`;
