const hosts: Record<string, string[]> = {
  github: ['avatars.githubusercontent.com'],
  gitlab: ['gitlab.com', 'assets.gitlab-static.net', 'secure.gravatar.com', 'www.gravatar.com'],
  spotify: [
    'i.scdn.co',
    'mosaic.scdn.co',
    'image-cdn-ak.spotifycdn.com',
    'image-cdn-fa.spotifycdn.com',
  ],
  steam: [
    'cdn.cloudflare.steamstatic.com',
    'cdn.akamai.steamstatic.com',
    'shared.fastly.steamstatic.com',
    'avatars.steamstatic.com',
    'avatars.akamai.steamstatic.com',
    'avatars.cloudflare.steamstatic.com',
  ],
  discord: ['cdn.discordapp.com', 'media.discordapp.net'],
  linkedin: ['media.licdn.com'],
  telegram: ['telegram.org', 'telesco.pe'],
  x: ['pbs.twimg.com'],
};

const imageKey = /^(images?|avatar|avatar_url|photo|banner|header|hero)$/;

function allowedURL(provider: string, url: URL): boolean {
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash)
    return false;
  if (
    provider === 'gitlab' &&
    url.hostname === 'gitlab.com' &&
    !url.pathname.startsWith('/uploads/')
  )
    return false;
  return (hosts[provider] || []).some(
    (host) =>
      url.hostname === host || (provider === 'telegram' && url.hostname.endsWith(`.${host}`)),
  );
}

export function allowedMedia(provider: string, source: string): boolean {
  try {
    return allowedURL(provider, new URL(source));
  } catch {
    return false;
  }
}

// Hosts that render any square size from the same URL. Asking for the size the
// page actually draws is the difference between a 460px, 44 KB avatar and a
// 6 KB one. Anything not listed here has no size lever and is left alone.
const sizeParam: Record<string, string> = {
  'avatars.githubusercontent.com': 's',
  'secure.gravatar.com': 's',
  'www.gravatar.com': 's',
  'cdn.discordapp.com': 'size',
  'media.discordapp.net': 'size',
};

/** Discord serves only powers of two, from 16 up to 4096. */
const discordSize = (size: number) => Math.min(4096, Math.max(16, 2 ** Math.ceil(Math.log2(size))));

/** `source` with a size hint its host understands, or unchanged if it has none. */
export function resizedSource(source: string, size: number): string {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return source;
  }
  const param = sizeParam[url.hostname];
  if (!param || !(size > 0)) return source;
  url.searchParams.set(param, String(param === 'size' ? discordSize(size) : Math.round(size)));
  return url.href;
}

function resolveMedia(source: string): { provider: string; url: URL } | undefined {
  // Most strings in provider JSON are names and descriptions. Avoid parsing those.
  if (!source.startsWith('https://')) return undefined;
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return undefined;
  }
  const provider = Object.keys(hosts).find((candidate) => allowedURL(candidate, url));
  return provider ? { provider, url } : undefined;
}

export function mediaPath(source: string): string | null {
  const resolved = resolveMedia(source);
  if (!resolved) return null;
  // Self-contained asset identifiers avoid a KV write for every album image.
  const id = btoa(resolved.url.href).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `/media/${resolved.provider}/${id}`;
}

export function rewriteMedia(value: unknown, base: string, imageField = false): unknown {
  if (typeof value === 'string') {
    const path = mediaPath(value);
    if (path) return `${base}${path}`;
    if (/^\/(?:(telegram|discord)\/avatar|(x|linkedin)\/(avatar|banner))(?:\?|$)/.test(value))
      return `${base}${value}`;
    return imageField && /^https?:|^\/\//.test(value) ? null : value;
  }
  // Returning the original reference when nothing changed lets callers skip
  // re-serialising payloads that carry no media URLs at all.
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const rewritten = rewriteMedia(item, base, imageField);
      if (rewritten !== item) changed = true;
      return rewritten;
    });
    return changed ? next : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const entries = Object.entries(value).map(([key, item]) => {
      const rewritten = rewriteMedia(item, base, imageField || imageKey.test(key));
      if (rewritten !== item) changed = true;
      return [key, rewritten];
    });
    return changed ? Object.fromEntries(entries) : value;
  }
  return value;
}
