export function telegramUsername(value) {
  if (value == null) return null;
  let candidate = String(value).trim();
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const parsed = new URL(candidate);
      if (!/^t\.me$/i.test(parsed.hostname)) return null;
      candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } catch {
      return null;
    }
  }
  candidate = candidate.replace(/^@/, '').trim();
  return /^[A-Za-z0-9_]{5,32}$/.test(candidate) ? candidate.toLowerCase() : null;
}
