import { z } from 'zod';
import type { Services } from '../contracts.js';
import { json, fetchAllowed, readBytes } from '../lib/http.js';
import { withCache } from '../lib/cache.js';
import { metaContent } from '../lib/html.js';

function allowedLinkedIn(value: string): boolean {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    /(^|\.)linkedin\.com$/i.test(url.hostname)
  );
}

const LINKEDIN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.google.com/',
};

// Only ever fetch a real https://*.linkedin.com URL from env — never an
// arbitrary string that could point anywhere.
function linkedinProfileUrl(services: Services) {
  if (!services.config.LINKEDIN_URL) return null;
  try {
    const u = new URL(services.config.LINKEDIN_URL);
    if (u.protocol !== 'https:') return null;
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

// LinkedIn blocks a bare request with HTTP 999 — it only serves the page once
// the client presents session cookies (bcookie/li_gc/JSESSIONID) issued by a
// prior visit. So: warm up with one request to collect Set-Cookie, then
// replay with those cookies attached.
async function fetchLinkedInHtml(services: Services, url: string) {
  const warmup = await fetchAllowed(services, url, allowedLinkedIn, { headers: LINKEDIN_HEADERS });
  const cookie = warmup.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

  await warmup.body?.cancel();
  const res = await fetchAllowed(services, url, allowedLinkedIn, {
    headers: { ...LINKEDIN_HEADERS, Cookie: cookie },
  });
  if (!res.ok) return null;
  const bytes = await readBytes(res, 256 * 1024);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

export async function handle(request: Request, services: Services) {
  const { pathname } = new URL(request.url);
  if (pathname !== '/linkedin') return null;

  const profileUrl = linkedinProfileUrl(services);
  if (!profileUrl) return json({ error: 'linkedin_not_configured' }, 503);

  return withCache(services, request, async () => {
    const stateKey = `linkedin:profile:v1:${profileUrl}`;
    try {
      const html = await fetchLinkedInHtml(services, profileUrl);
      const title = html ? metaContent(html, 'og:title') : null;
      if (!title || /sign in|sign up|security verification/i.test(title))
        throw new Error('linkedin_fetch_failed');
      const [name, headline] = title.replace(/\s*\|\s*LinkedIn$/i, '').split(/\s+-\s+/, 2);
      const profile = {
        name: name?.trim() || null,
        headline: headline?.trim() || null,
        avatar: metaContent(html || '', 'og:image'),
        url: profileUrl,
      };
      await services.state.put(stateKey, JSON.stringify({ profile, updatedAt: services.now() }));
      return json(profile, 200, 3600);
    } catch {
      const raw = await services.state.get(stateKey);
      if (raw) {
        try {
          const snapshot = z
            .object({
              updatedAt: z.number(),
              profile: z.object({
                name: z.string().nullable(),
                headline: z.string().nullable(),
                avatar: z.string().nullable(),
                url: z.string(),
              }),
            })
            .parse(JSON.parse(raw));
          if (services.now() - snapshot.updatedAt < 7 * 86400000) {
            const response = json(snapshot.profile, 200, 300);
            response.headers.set('X-Cache-Stale', 'true');
            return response;
          }
        } catch {
          /* A malformed snapshot cannot be used as a fallback. */
        }
      }
      return json({ error: 'linkedin_fetch_failed' }, 200, 300);
    }
  });
}
