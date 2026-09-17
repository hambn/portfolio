export function linkedinUsername(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim();
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (
        !['linkedin.com', 'www.linkedin.com'].includes(url.hostname) ||
        url.port ||
        url.username ||
        url.password
      )
        return null;
      candidate = url.pathname.match(/^\/in\/([^/]+)\/?$/)?.[1] || '';
    } catch {
      return null;
    }
  }
  return /^[a-z0-9][a-z0-9-]{0,99}$/i.test(candidate) ? candidate.toLowerCase() : null;
}
