/**
 * data.js — Portfolio content layer
 *
 * Single source of truth for fetching content from contents/.
 * Results are cached in memory so multiple components share one request.
 *
 * Usage in any JSX component:
 *   window.PortfolioData.getProfile().then(p => setProfile(p))
 *   window.PortfolioData.getLinks().then(l => setLinks(l))
 */

window.PortfolioData = (() => {
  // Resolve to an ABSOLUTE url once, at load time (set in globals.js). Blog
  // routes like /blog/<slug> add a path segment, which would otherwise
  // re-anchor a relative base and 404 the fetches.
  const BASE = (() => {
    const raw = window.CONTENT_BASE || '../../contents';
    try { return new URL(raw, document.baseURI).href.replace(/\/+$/, ''); }
    catch (e) { return raw; }
  })();

  const _cache = {};

  /** Deduplicate in-flight requests and cache results. */
  const cached = (key, fn) => {
    if (!_cache[key]) {
      _cache[key] = fn().catch(err => {
        delete _cache[key]; // allow retry on error
        throw err;
      });
    }
    return _cache[key];
  };

  const getJSON = async (path) => {
    const r = await fetch(BASE + path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`[PortfolioData] ${r.status} — ${path}`);
    return r.json();
  };

  /* ──────────────────────────────────────────────────────────────
     Blog: fully file-driven, zero manifest to maintain.

     scripts/blog-index.mjs scans the .md files under contents/blogs/
     at build time
     (and on dev start / file change, via the Vite plugin) and emits
     blogs/blog-data.json — already parsed and sorted newest-first.
     Drop a .md file with frontmatter to publish; omit the `title` to
     keep it an unlisted draft. The route slug is the filename without
     .md, so keep filenames unique across folders.
     ────────────────────────────────────────────────────────────── */
  const getBlogIndex = () => cached('blogIndex', () => getJSON('/blogs/blog-data.json'));

  return {
    /** { name, handle, title, bio, avatar } */
    getProfile:   () => cached('profile', () => getJSON('/home/profile.json')),

    /** { items[], skills[] } */
    getResume:    () => cached('resume',  () => getJSON('/home/resume.json')),

    /** { discord, spotify, github, steam, x, telegram, linkedin } */
    getLinks:     () => cached('links',   () => getJSON('/links/links.json')),

    /** [{ slug, path, title, date, description, tags, body }] sorted newest-first */
    getBlogIndex,

    /** Raw markdown body (frontmatter stripped) for a post by slug */
    getBlogPost:  async (slug) => {
      const post = (await getBlogIndex()).find(p => p.slug === slug);
      if (!post) throw new Error(`[PortfolioData] no post: ${slug}`);
      return post.body;
    },
  };
})();
