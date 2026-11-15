import React, { Suspense, startTransition, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Shell from './components/Shell.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ErrorState from './components/ErrorState.jsx';
import NotFound from './components/NotFound.jsx';
import { pageComponent, pages, preloadPage, warmPages } from './pages/index.js';

import { currentRoute, routeOf } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { warmSite } from './lib/siteFeed.js';
import { routeMetadata, updateDocumentMetadata, updateNotFoundMetadata } from './lib/metadata.js';

// How long a navigation waits for the next page's code before showing the
// loading state in its place.
const ROUTE_WAIT = 3000;

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
      : pageComponent(page);
  const firstRender = useRef(true);

  // On history navigation, restore the scroll offset saved with the entry.
  // A fragment link on the same route also fires popstate; the browser has
  // already scrolled to the target, so that is left alone.
  useEffect(() => {
    let shown = currentRoute();
    let turn = 0;
    const onPop = () => {
      const next = currentRoute();
      const moved = next !== shown;
      shown = next;
      const y = window.history.state?.scrollY ?? 0;
      if (!moved) {
        // Same page (a query or fragment changed): nothing to fade in.
        startTransition(() => setRoute(next));
        if (!window.location.hash) window.requestAnimationFrame(() => window.scrollTo(0, y));
        return;
      }
      // The page being left stays on screen, where it was scrolled, until the
      // next one can render whole: its code, and a post's rendered HTML.
      const target = pageOf(next);
      const slug = target === 'blog' && next.split('/')[1];
      const ready = Promise.all([
        target && preloadPage(target),
        slug && PortfolioData.getPostHtml(slug),
      ]).catch(() => {});
      const mine = ++turn;
      // Past the wait, switch anyway and let the Suspense fallback say so.
      Promise.race([ready, new Promise((done) => setTimeout(done, ROUTE_WAIT))]).then(() => {
        if (mine !== turn) return;
        // The switch itself is immediate: the new page is on screen, and can
        // be scrolled and clicked, in the frame after the click. It fades in
        // briefly (core.css, page-in) so the change does not read as a cut.
        document.documentElement.setAttribute('data-navigated', '');
        flushSync(() => setRoute(next));
        window.scrollTo(0, y);
        // Back to a page that fills in after its first render (the project
        // lists): it is not yet tall enough to scroll to where it was left.
        let tries = 0;
        const settle = () => {
          if (mine !== turn || window.scrollY >= y - 1 || tries++ >= 6) return;
          window.scrollTo(0, y);
          setTimeout(settle, 16);
        };
        settle();
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // After the first paint, fetch what the other pages open with: the API's
  // one answer for the links and projects pages, the blog index, every
  // route's code and fonts, and the link cards' images (pages/index.js).
  useEffect(() => {
    warmSite({
      content: PortfolioData,
      preload: warmPages,
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
