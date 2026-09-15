// History router shared by the app shell and page components.
// BASE_PATH mirrors Vite's base so navigation works at any deploy route.

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** Push a route ("blog", "blog/my-post", "blog?tag=infra") and notify the router. */
export function navigate(page) {
  const url = page === 'home' ? BASE_PATH + '/' : BASE_PATH + '/' + page;
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
