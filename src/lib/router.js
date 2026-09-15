// History router shared by the app shell and page components.
// BASE_PATH mirrors Vite's base so navigation works at any deploy route.

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Push a route ("blog", "blog/my-post", "blog?tag=infra") and notify the router. */
export function navigate(page) {
  const [path, query] = page.split('?');
  const clean = path === 'home' ? '' : path.replace(/^\/+|\/+$/g, '');
  // Canonical form ends in a slash, matching the prerendered <link rel="canonical">
  // and how static hosts serve directory index.html files.
  const url = (clean ? `${BASE_PATH}/${clean}/` : `${BASE_PATH}/`) + (query ? `?${query}` : '');
  window.history.pushState({ page }, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Current route relative to the base path, e.g. "home" or "blog/my-post". */
export function currentRoute() {
  const rel = window.location.pathname
    .replace(BASE_PATH, '')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/^index\.html$/, '');
  return rel || 'home';
}
