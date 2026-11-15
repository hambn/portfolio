// Page registry — every route is a lazy chunk so the first load ships the app
// shell plus only the page being viewed. main.jsx loads the entry route before
// hydration; other routes load when opened.
import { lazy } from 'react';

const ASSET_RELOAD_PARAM = '__asset_reload';

function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /dynamically imported module|module script failed|failed to fetch/i.test(message);
}

function clearAssetReloadMarker() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(ASSET_RELOAD_PARAM)) return;
  url.searchParams.delete(ASSET_RELOAD_PARAM);
  window.history.replaceState(window.history.state, '', url.href);
}

/**
 * A deploy can leave a browser holding the previous HTML or entry chunk while
 * its hashed page chunk has already been replaced. Fetch the document once
 * with a throwaway query so a normal reload can recover without asking people
 * to use a hard reload.
 */
function loadWithRecovery(load) {
  return load()
    .then((module) => {
      clearAssetReloadMarker();
      return module;
    })
    .catch((error) => {
      if (typeof window === 'undefined' || !isChunkLoadError(error)) throw error;
      const url = new URL(window.location.href);
      if (url.searchParams.has(ASSET_RELOAD_PARAM)) throw error;
      url.searchParams.set(ASSET_RELOAD_PARAM, String(Date.now()));
      window.location.replace(url.href);
      return new Promise(() => {});
    });
}

const loaders = {
  home: () => import('./home/Home.jsx'),
  projects: () => import('./projects/Projects.jsx'),
  blog: () => import('./blog/Blog.jsx'),
  links: () => import('./links/Links.jsx'),
  resume: () => import('./resume/Resume.jsx'),
};

export const pages = Object.fromEntries(
  Object.entries(loaders).map(([key, load]) => [key, lazy(() => loadWithRecovery(load))]),
);

// Components whose chunk has arrived, and the one each page was first rendered
// with.
const loaded = {};
const chosen = {};

/** Start a route chunk download now (called before hydration). */
export function preloadPage(page) {
  if (!loaders[page]) return undefined;
  return loadWithRecovery(loaders[page]).then((module) => {
    loaded[page] = module.default;
    return module;
  });
}

/**
 * The component to render a page with: the loaded one where its chunk is
 * already here, so it renders at once instead of suspending for a tick, and
 * the lazy wrapper otherwise. The first answer is kept, since changing
 * component would remount the page.
 */
export function pageComponent(page) {
  if (!pages[page]) return null;
  return (chosen[page] ??= loaded[page] || pages[page]);
}
