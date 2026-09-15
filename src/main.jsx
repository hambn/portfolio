// SPA entry — app shell + history router.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted JetBrains Mono (woff2 bundled by Vite — no Google Fonts request).
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/index.css';
import './styles/blog.css';

import Nav from './components/Nav.jsx';
import { pages } from './pages/index.js';
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Nav page={page} />
      <Page route={route} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
