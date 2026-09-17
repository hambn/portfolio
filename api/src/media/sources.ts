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
};

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

export function mediaProvider(source: string): string | undefined {
  // Most strings in provider JSON are names and descriptions. Avoid parsing those.
  if (!source.startsWith('https://')) return undefined;
  try {
    const url = new URL(source);
    return Object.keys(hosts).find((provider) => allowedURL(provider, url));
  } catch {
    return undefined;
  }
}

export function mediaPath(source: string): string | null {
  const provider = mediaProvider(source);
  if (!provider) return null;
  const normalized = new URL(source).href;
  // Self-contained asset identifiers avoid a KV write for every album image.
  return `/media/${provider}/${btoa(normalized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

export function rewriteMedia(value: unknown, base: string, imageField = false): unknown {
  if (typeof value === 'string') {
    const path = mediaPath(value);
    if (path) return `${base}${path}`;
    if (/^\/(telegram|discord)\/avatar(?:\?|$)/.test(value)) return `${base}${value}`;
    return imageField && /^https?:|^\/\//.test(value) ? null : value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteMedia(item, base, imageField));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        rewriteMedia(
          item,
          base,
          imageField || /^(images?|avatar|avatar_url|photo|banner|header|hero)$/.test(key),
        ),
      ]),
    );
  return value;
}
