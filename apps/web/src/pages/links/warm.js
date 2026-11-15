// warm — what /links draws, fetched ahead while another page is open.
//
// lib/siteFeed.js already holds the cards' data by the time this runs; this
// asks for the images that data points at, so opening the page from home finds
// avatars, banners and badges in the HTTP cache instead of starting a dozen
// requests through the media proxy. Each URL is built exactly as its card
// builds it (same helpers, same sizes): a URL that differs by one query
// parameter would be a second download, not a cache hit.
//
// Only what the API answered is used. Cards that ask their provider directly,
// and live data (Spotify playback, Discord presence), are left to the page.
import { API_BASE, cardImage, mediaUrl } from '../../lib/api.js';
import { PortfolioData } from '../../lib/data.js';
import { cardKeys, cardSeed, ensureCards, settled } from '../../lib/siteFeed.js';
import { prefetchImage } from '../../lib/prefetch.js';
import { AVATAR as GITHUB_AVATAR } from './github/GitHubCard.jsx';
import { AVATAR as GITLAB_AVATAR } from './gitlab/GitLabCard.jsx';

const KEYS = ['discord', 'telegram', 'x', 'github', 'gitlab', 'linkedin', 'steam'];

// X, LinkedIn and Telegram resolve their image paths against the API.
const fromApi = (path) => (path ? new URL(path, `${API_BASE}/`).href : null);

function steamGame(game) {
  if (!game || typeof game !== 'object') return [];
  return [game.images?.hero, game.images?.header].map(mediaUrl);
}

const IMAGES = {
  discord: (d) => [mediaUrl(d.avatar)],
  telegram: (d) => [fromApi(d.photo)],
  x: (d) => [fromApi(d.avatar), fromApi(d.banner)],
  linkedin: (d) => [fromApi(d.avatar), fromApi(d.banner)],
  github: (d) => [
    cardImage(d.avatar_url, GITHUB_AVATAR),
    ...(d.page?.achievements || []).map((badge) => cardImage(badge.image)),
    ...(d.page?.organizations || []).map((org) => cardImage(org.image, 32)),
  ],
  gitlab: (d) => [cardImage(d?.[0]?.avatar_url, GITLAB_AVATAR)],
  steam: (d) => [
    mediaUrl(d.avatar?.large),
    ...steamGame(d.currentGame),
    ...steamGame(d.favoriteGame),
    ...(d.recentActivity || []).flatMap(steamGame),
  ],
};

// The Telegram card's background, a mask in TelegramCard.css (same path).
const TELEGRAM_PATTERN = '/assets/telegram/pattern.svg';

/** Fetch every card image the API's answer names, once it has arrived. */
export async function warm() {
  const config = await PortfolioData.getLinks();
  if (config.telegram) fetch(TELEGRAM_PATTERN).catch(() => {});
  // The same request warmSite makes: whichever of the two asks first sends
  // it, and the other finds the entries already on their way.
  const keys = [...cardKeys(config, { live: false }), 'projects'];
  ensureCards(keys);
  return settled(keys).then(() => {
    for (const key of KEYS) {
      const seed = cardSeed(key);
      if (seed.status !== 'ready' || seed.data == null) continue;
      try {
        IMAGES[key](seed.data).forEach(prefetchImage);
      } catch {
        // A field in an unexpected shape: the card copes with it on the page.
      }
    }
  });
}
