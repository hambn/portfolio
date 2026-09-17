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
      /^\/(?:api\/)?(?:media\/|telegram\/avatar|discord\/avatar)/.test(source)
    ) {
      return new URL(source, API_BASE).href;
    }
    return source;
  }
  if (source.startsWith(`${API_BASE}/`)) return source;
  const path = mediaPath(source);
  return path ? apiUrl(path) : null;
}

export function socketUrl() {
  const url = new URL(apiUrl('/discord/socket'), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export function apiContent(key, value) {
  if (key === 'profile') return { ...value, avatar: mediaUrl(value.avatar) };
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
