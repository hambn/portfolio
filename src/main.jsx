import { mediaUrl } from './lib/api.js';
// SPA entry — app shell + history router.
import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
// Self-hosted JetBrains Mono variable font (one woff2 for every weight —
// no Google Fonts request).
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';
import './styles/blog.css';

import App from './App.jsx';
import { pages, preloadPage } from './pages/index.js';
import { currentRoute } from './lib/router.js';

// Round the API-hosted avatar into a tab favicon after it loads.
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
})(mediaUrl('https://avatars.githubusercontent.com/hambn'));

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
