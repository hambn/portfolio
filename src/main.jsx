// SPA entry — app shell + history router.
import React, { Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted JetBrains Mono variable font (one woff2 for every weight —
// no Google Fonts request).
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';
import './styles/blog.css';

import Nav from './components/Nav.jsx';
import { pages, preloadPage } from './pages/index.js';
import { currentRoute } from './lib/router.js';

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

  useEffect(() => {
    const saved = localStorage.getItem('hambn-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Warm every route chunk once the first page is interactive, so in-app
  // navigation never waits on the network.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => Object.keys(pages).forEach(preloadPage));
    return () => cancel(id);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Nav page={page} />
      <Suspense fallback={null}>
        <Page route={route} />
      </Suspense>
    </div>
  );
}

// Kick the entry route's chunk off before the first render so the prerendered
// HTML is swapped for the real page in one step.
const initial = (currentRoute() || 'home').split('/')[0] || 'home';
preloadPage(pages[initial] ? initial : 'home');

createRoot(document.getElementById('root')).render(<App />);
