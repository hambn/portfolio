import { mediaPath } from '../../api/src/media/sources.ts';

export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'https://api.portfolio.hgh.dev'
).replace(/\/+$/, '');
export const apiUrl = (path) => `${API_BASE}/${path.replace(/^\/+/, '')}`;

export function mediaUrl(source) {
  if (!source) return null;
  if (source.startsWith('/') && !source.startsWith('//')) {
    if (
      /^https?:/.test(API_BASE) &&
      /^\/(?:api\/)?(?:media\/|telegram\/avatar|discord\/avatar|(?:x|linkedin)\/(?:avatar|banner))/.test(
        source,
      )
    ) {
      return new URL(source, API_BASE).href;
    }
    return source;
  }
  if (source.startsWith(`${API_BASE}/`)) return source;
  const path = mediaPath(source);
  return path ? apiUrl(path) : null;
}

// GitHub renders an avatar at any square size from the same URL via ?s=, and
// the media proxy passes the query through untouched. Asking for the size the
// page actually draws turns the stock 460px, 44 KB PNG into a ~6 KB one.
const GITHUB_AVATAR = /^https:\/\/avatars\.githubusercontent\.com\//;

/** `<img>` props for a square avatar rendered at `size` CSS pixels. */
export function avatarImage(source, size) {
  if (!source) return {};
  if (!GITHUB_AVATAR.test(source)) return { src: mediaUrl(source) ?? undefined };
  const at = (scale) => mediaUrl(`${source}${source.includes('?') ? '&' : '?'}s=${size * scale}`);
  return { src: at(1), srcSet: `${at(1)} 1x, ${at(2)} 2x` };
}

export function socketUrl() {
  const url = new URL(apiUrl('/discord/socket'), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export function apiContent(key, value) {
  // `avatar` is the full-size image social cards and JSON-LD point at;
  // `avatarSource` keeps the un-proxied original so avatarImage() can ask for
  // a smaller rendition than the one meta tags advertise.
  if (key === 'profile')
    return { ...value, avatarSource: value.avatar, avatar: mediaUrl(value.avatar) };
  if (key !== 'links') return value;
  return Object.fromEntries(
    Object.entries(value).map(([provider, config]) => [
      provider,
      {
        ...config,
        ...(config.apiEndpoint ? { apiEndpoint: apiUrl(`/${provider}`) } : {}),
        ...(config.avatar ? { avatar: mediaUrl(config.avatar) } : {}),
        ...(config.banner ? { banner: mediaUrl(config.banner) } : {}),
      },
    ]),
  );
}
