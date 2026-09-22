// History router shared by the app shell and page components.
// BASE_PATH mirrors Vite's base so navigation works at any deploy route.

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

/**
 * URL for a route ("home", "blog/my-post", "blog?tag=infra"). The canonical
 * form ends in a slash, matching the prerendered <link rel="canonical"> and
 * how static hosts serve directory index.html files.
 */
export function routeHref(page) {
  const [path, query] = page.split('?');
  const clean = path === 'home' ? '' : path.replace(/^\/+|\/+$/g, '');
  return (clean ? `${BASE_PATH}/${clean}/` : `${BASE_PATH}/`) + (query ? `?${query}` : '');
}

/** Push a route and notify the router. */
export function navigate(page) {
  // Remember where the outgoing page was scrolled so Back can restore it.
  window.history.replaceState({ ...(window.history.state || {}), scrollY: window.scrollY }, '');
  window.history.pushState({ page }, '', routeHref(page));
  window.scrollTo(0, 0);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * onClick for an in-app <a href={routeHref(page)}>. A plain left click routes
 * in place; modified and middle clicks keep the browser default, so
 * ctrl/cmd-click still opens the page in a new tab.
 */
export function followRoute(page) {
  return (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(page);
  };
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
