import { mediaPath, resizedSource } from '../../api/src/media/sources.ts';

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

const PROXIED_MEDIA = /\/media\/[a-z]+\/([A-Za-z0-9_-]+)$/;

/**
 * Ask for a smaller rendition of an image the API has already proxied. The
 * upstream URL is base64 inside the proxy path, so decode it, let sources.ts
 * apply whatever size lever that host understands, and re-encode. Hosts
 * without one — and anything that isn't a proxy URL — come back untouched.
 * `size` is in CSS pixels; the request is doubled to stay sharp on 2x screens.
 */
export function sizedMedia(url, size) {
  const id = typeof url === 'string' ? url.match(PROXIED_MEDIA)?.[1] : null;
  if (!id) return url;
  try {
    const source = atob(id.replace(/-/g, '+').replace(/_/g, '/'));
    const resized = resizedSource(source, size * 2);
    return resized === source ? url : (mediaUrl(resized) ?? url);
  } catch {
    return url;
  }
}

/**
 * Pick the smallest rendition that still covers `size` CSS pixels on a 2x
 * screen. Providers hand back the same artwork at several widths (Spotify:
 * 640/300/64) sorted largest-first, so reaching for `images[0]` drops a 640px
 * file into a 44px slot. Renditions without a declared width sort last.
 */
export function pickImage(images, size) {
  const sized = (Array.isArray(images) ? images : []).filter((image) => image?.url);
  if (!sized.length) return null;
  const covers = sized
    .filter((image) => image.width)
    .sort((a, b) => a.width - b.width)
    .find((image) => image.width >= size * 2);
  return mediaUrl((covers || sized[0]).url);
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
