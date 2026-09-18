import React, { Suspense, useEffect, useRef, useState } from 'react';
import Shell from './components/Shell.jsx';
import { pages } from './pages/index.js';
import { currentRoute } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { routeMetadata, updateDocumentMetadata } from './lib/metadata.js';

export default function App({ initialRoute, initialPage }) {
  const [route, setRoute] = useState(() => initialRoute || currentRoute());
  const page = (route || 'home').split('/')[0] || 'home';
  const Page = route === initialRoute && initialPage ? initialPage : pages[page] || pages.home;
  const firstRender = useRef(true);

  // On history navigation, restore the scroll offset saved with the entry.
  useEffect(() => {
    const onPop = () => {
      setRoute(currentRoute());
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
    <Shell page={page}>
      <Suspense
        fallback={
          <p className="page-loading" role="status">
            loading...
          </p>
        }
      >
        <Page route={route} />
      </Suspense>
    </Shell>
  );
}
