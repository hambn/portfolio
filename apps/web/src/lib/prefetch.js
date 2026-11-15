// prefetch — fetch an image a page will draw before that page is opened.
//
// Used by the pages' `warm` exports (see warmPages in pages/index.js). The
// request matches the one the page's own <img> makes, so it leaves the cache
// entry that <img> will find: no crossOrigin (the pages set none), and with a
// srcSet the browser picks the same density candidate it will pick on the page.

const fetched = new Set();

/** Fetch an image once per visit. Accepts a URL or `{ src, srcSet }`. */
export function prefetchImage(image) {
  const { src, srcSet } = typeof image === 'string' ? { src: image } : image || {};
  const key = srcSet || src;
  if (!key || fetched.has(key)) return;
  fetched.add(key);
  const img = new Image();
  img.decoding = 'async';
  img.fetchPriority = 'low';
  if (srcSet) img.srcset = srcSet;
  if (src) img.src = src;
}
