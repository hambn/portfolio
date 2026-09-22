// SPA entry — app shell + history router.
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
// styles/fonts.css self-hosts JetBrains Mono (one woff2 for every weight —
// no Google Fonts request).
import './styles/index.css';

import App from './App.jsx';
import { pages, preloadPage } from './pages/index.js';
import { currentRoute } from './lib/router.js';

// Round the square avatar into a circular tab favicon. It redraws whatever the
// document already declares as its icon — written by prerender.mjs from
// contents/home/profile.json — so the avatar URL isn't repeated here, and the
// browser serves this fetch from cache instead of downloading a second copy.
function roundFavicon(size) {
  const link = document.querySelector("link[rel='icon']");
  if (!link?.href) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
  };
  img.src = link.href;
}

// A tab icon is worth nothing before the page paints, and the decode plus
// canvas export is not free — wait for an idle moment, or the load event where
// requestIdleCallback is missing (Safari), so it never competes with hydration.
const drawFavicon = () => roundFavicon(64);
if (typeof requestIdleCallback === 'function') requestIdleCallback(drawFavicon, { timeout: 4000 });
else window.addEventListener('load', drawFavicon, { once: true });

const initialRoute = currentRoute();
const initial = (initialRoute || 'home').split('/')[0] || 'home';
const root = document.getElementById('root');

// Keep the complete static page visible while its interactive code downloads.
preloadPage(pages[initial] ? initial : 'home')
  .then(({ default: initialPage }) => {
    const app = <App initialRoute={initialRoute} initialPage={initialPage} />;
    if (root.hasChildNodes()) hydrateRoot(root, app);
    else createRoot(root).render(app);
  })
  .catch((error) => {
    console.error('Unable to load the page', error);
    if (!root.hasChildNodes())
      root.textContent = 'Unable to load the page. Please reload to try again.';
  });
