export function linkedinUsername(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim();
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (
        !/^(?:www\.|[a-z]{2}\.)?linkedin\.com$/.test(url.hostname) ||
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
