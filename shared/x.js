export function xUsername(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim();
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (
        !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) ||
        url.port ||
        url.username ||
        url.password
      )
        return null;
      candidate = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } catch {
      return null;
    }
  }
  candidate = candidate.replace(/^@/, '');
  return /^[a-z0-9_]{1,15}$/i.test(candidate) ? candidate.toLowerCase() : null;
}
