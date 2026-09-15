// SPA entry — app shell + history router.
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted JetBrains Mono variable font (one woff2 for every weight —
// no Google Fonts request).
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';
import './styles/blog.css';

import Nav from './components/Nav.jsx';
import { pages, preloadPage } from './pages/index.js';
import { currentRoute } from './lib/router.js';
import { PortfolioData } from './lib/data.js';
import { routes } from './routes.js';

// Round the tab favicon client-side: GitHub's avatar CDN sends CORS headers,
// so canvas can crop it circular (an SVG favicon can't reference cross-origin
// images at all — this sidesteps that restriction) while staying a live URL.
(function roundFavicon(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  };
  img.src = url;
})('https://avatars.githubusercontent.com/hambn');

function App() {
  const [route, setRoute] = useState(currentRoute);
  const page = (route || 'home').split('/')[0] || 'home';
  const Page = pages[page] || pages.home;
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

  // Warm every route chunk once the first page is interactive, so in-app
  // navigation never waits on the network.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => Object.keys(pages).forEach(preloadPage));
    return () => cancel(id);
  }, []);

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <a href="#content" className="skip-link">
        skip to content
      </a>
      <Nav page={page} />
      <div id="content" tabIndex={-1}>
        <Suspense fallback={null}>
          <Page route={route} />
        </Suspense>
      </div>
    </div>
  );
}

// Kick the entry route's chunk off before the first render so the prerendered
// HTML is swapped for the real page in one step.
const initial = (currentRoute() || 'home').split('/')[0] || 'home';
preloadPage(pages[initial] ? initial : 'home');

createRoot(document.getElementById('root')).render(<App />);
