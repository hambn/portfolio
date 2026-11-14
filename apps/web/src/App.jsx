import React, { Suspense, startTransition, useEffect, useRef, useState } from 'react';
import Shell from './components/Shell.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ErrorState from './components/ErrorState.jsx';
import NotFound from './components/NotFound.jsx';
import { pages, preloadPage } from './pages/index.js';

import { currentRoute, routeOf } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { warmSite } from './lib/siteFeed.js';
import { routeMetadata, updateDocumentMetadata, updateNotFoundMetadata } from './lib/metadata.js';

// The page a route belongs to; null when its first segment names none, which
// renders the not-found view (404.html boots the app at such a URL).
const pageOf = (route) => {
  const page = (route || 'home').split('/')[0] || 'home';
  return pages[page] ? page : null;
};

export default function App({ initialRoute, initialPage }) {
  const [route, setRoute] = useState(() => initialRoute || currentRoute());
  const page = pageOf(route);
  // The page loaded before hydration stays in use for every route it renders
  // (blog list and posts alike). Switching to its lazy wrapper would remount
  // it and flash the Suspense fallback on the first in-page navigation.
  const Page = !page
    ? NotFound
    : initialPage && initialRoute && page === pageOf(initialRoute)
      ? initialPage
      : pages[page];
  const firstRender = useRef(true);

  // On history navigation, restore the scroll offset saved with the entry.
  // A fragment link on the same route also fires popstate; the browser has
  // already scrolled to the target, so that is left alone.
  useEffect(() => {
    let shown = currentRoute();
    const onPop = () => {
      const next = currentRoute();
      const moved = next !== shown;
      // From here on a newly opened page fades in (core.css, page-in).
      if (moved) document.documentElement.setAttribute('data-navigated', '');
      // A transition keeps the page being left on screen while the next
      // route's chunk loads, instead of blanking to the Suspense fallback.
      startTransition(() => setRoute(next));
      shown = next;
      if (!moved && window.location.hash) return;
      const y = window.history.state?.scrollY ?? 0;
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // After the first paint, fetch what the other pages open with: the API's
  // one answer for the links and projects pages, the blog index, and every
  // route's code.
  useEffect(() => {
    warmSite({
      content: PortfolioData,
      preload: () => Object.keys(pages).forEach((name) => preloadPage(name)?.catch(() => {})),
    });
  }, []);

  // Start downloading a route's code as soon as a link to it is pointed at,
  // touched or focused, so the click that follows finds it already loaded.
  useEffect(() => {
    const warm = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      const route = routeOf(link.pathname);
      const target = route === null ? null : pageOf(route);
      if (!target) return;
      preloadPage(target)?.catch(() => {});
      // A post is one small file of rendered HTML; have it ready as well.
      const slug = target === 'blog' && route.split('/')[1];
      if (slug) PortfolioData.getPostHtml(slug).catch(() => {});
    };
    const options = { passive: true };
    document.addEventListener('pointerover', warm, options);
    document.addEventListener('touchstart', warm, options);
    document.addEventListener('focusin', warm);
    return () => {
      document.removeEventListener('pointerover', warm, options);
      document.removeEventListener('touchstart', warm, options);
      document.removeEventListener('focusin', warm);
    };
  }, []);

  // Keep navigation metadata consistent with the static page at the same URL.
  useEffect(() => {
    let alive = true;
    Promise.all([
      PortfolioData.getProfile(),
      route === 'blog' || route.startsWith('blog/') ? PortfolioData.getBlogIndex() : [],
    ])
      .then(([profile, posts]) => {
        if (!alive) return;
        const metadata = routeMetadata(route, profile, posts);
        if (metadata) updateDocumentMetadata(metadata, profile, posts);
        else updateNotFoundMetadata(profile);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [route]);

  // Move focus into the new page's content after client-side navigation so
  // keyboard and screen-reader users land on what changed (not on first render).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const content = document.getElementById('content');
    if (!content) return;
    content.focus({ preventScroll: true });
  }, [route]);

  return (
    <Shell page={(route || 'home').split('/')[0] || 'home'}>
      <Suspense
        fallback={
          <p className="page-loading" role="status">
            loading...
          </p>
        }
      >
        <ErrorBoundary
          resetKey={route}
          fallback={
            <main className="page-loading">
              <ErrorState
                message="this page failed to load."
                onRetry={() => window.location.reload()}
              />
            </main>
          }
        >
          <Page route={route} />
        </ErrorBoundary>
      </Suspense>
    </Shell>
  );
}
