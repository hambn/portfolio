import React, { Suspense, useEffect, useRef, useState } from 'react';
import Shell from './components/Shell.jsx';
import { pages } from './pages/index.js';
import { currentRoute } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { routes } from './routes.js';

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

  // Keep document.title in sync with the route. Titles come from routes.js so
  // client-side navigation matches what the prerenderer wrote.
  useEffect(() => {
    let alive = true;
    const [pageKey, ...rest] = (route || 'home').split('/');
    const slug = rest.join('/');
    const meta = routes.find((r) => r.page === (pageKey || 'home'));
    if (!meta) return;
    PortfolioData.getProfile()
      .then((p) => {
        if (!alive) return;
        document.title = meta.title({ profile: p });
        if (pageKey === 'blog' && slug) {
          PortfolioData.getBlogIndex()
            .then((posts) => {
              const post = posts.find((x) => x.slug === slug);
              if (alive && post) document.title = `${post.title} — ${p.name}`;
            })
            .catch(() => {});
        }
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
