import React, { Suspense, useEffect, useRef, useState } from 'react';
import Shell from './components/Shell.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ErrorState from './components/ErrorState.jsx';
import { pages } from './pages/index.js';

import { currentRoute } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { routeMetadata, updateDocumentMetadata, updateNotFoundMetadata } from './lib/metadata.js';

// Unknown first segments render home, as they always have (404.html boots it).
const pageOf = (route) => {
  const page = (route || 'home').split('/')[0] || 'home';
  return pages[page] ? page : 'home';
};

export default function App({ initialRoute, initialPage }) {
  const [route, setRoute] = useState(() => initialRoute || currentRoute());
  const page = pageOf(route);
  // The page loaded before hydration stays in use for every route it renders
  // (blog list and posts alike). Switching to its lazy wrapper would remount
  // it and flash the Suspense fallback on the first in-page navigation.
  const Page =
    initialPage && initialRoute && page === pageOf(initialRoute) ? initialPage : pages[page];
  const firstRender = useRef(true);

  // On history navigation, restore the scroll offset saved with the entry.
  // A fragment link on the same route also fires popstate; the browser has
  // already scrolled to the target, so that is left alone.
  useEffect(() => {
    let shown = currentRoute();
    const onPop = () => {
      const next = currentRoute();
      setRoute(next);
      const moved = next !== shown;
      shown = next;
      if (!moved && window.location.hash) return;
      const y = window.history.state?.scrollY ?? 0;
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
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
