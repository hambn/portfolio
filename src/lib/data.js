// Shared content requests and synchronous snapshots for page navigation.
import { apiContent } from './api.js';

export const PortfolioData = (() => {
  // Resolve to an ABSOLUTE url once, at load time, so blog routes like
  // /blog/<slug> don't re-anchor a relative path and 404 the fetches.
  const BASE = (() => {
    const raw = import.meta.env.BASE_URL.replace(/\/+$/, '') + '/contents';
    try {
      return new URL(raw, document.baseURI).href.replace(/\/+$/, '');
    } catch {
      return raw;
    }
  })();

  const _cache = {};
  let snapshot =
    typeof document === 'undefined'
      ? {}
      : JSON.parse(document.getElementById('portfolio-data')?.textContent || '{}');
  const seed = (data) => {
    snapshot = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, apiContent(key, value)]),
    );
    for (const key of Object.keys(_cache)) delete _cache[key];
    for (const [key, value] of Object.entries(snapshot)) _cache[key] = Promise.resolve(value);
  };
  seed(snapshot);

  /** Deduplicate in-flight requests and cache results. */
  const cached = (key, fn) => {
    if (!_cache[key]) {
      _cache[key] = fn()
        .then((value) => {
          snapshot[key] = value;
          return value;
        })
        .catch((err) => {
          delete _cache[key]; // allow retry on error
          throw err;
        });
    }
    return _cache[key];
  };

  const getJSON = async (path) => {
    const r = await fetch(BASE + path);
    if (!r.ok) throw new Error(`[PortfolioData] ${r.status} — ${path}`);
    return r.json();
  };

  const getBlogIndex = () => cached('blogIndex', () => getJSON('/blogs/blog-data.json'));

  return {
    seed,
    peek: (key) => snapshot[key] ?? null,
    /** { name, handle, title, bio, avatar } */
    getProfile: () =>
      cached('profile', () =>
        getJSON('/home/profile.json').then((value) => apiContent('profile', value)),
      ),

    /** { items[], skills[] } */
    getResume: () => cached('resume', () => getJSON('/home/resume.json')),

    /** { discord, spotify, github, steam, x, telegram, linkedin } */
    getLinks: () =>
      cached('links', () =>
        getJSON('/links/links.json').then((value) => apiContent('links', value)),
      ),

    /** [{ slug, path, title, date, description, tags, body }] sorted newest-first */
    getBlogIndex,
  };
})();
