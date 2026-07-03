// SPA entry — history router. Ported from the design kit's inline index.html
// script, with module imports replacing the Babel <script> tags.
import './globals.js';
// Self-hosted JetBrains Mono (woff2 bundled by Vite — no Google Fonts request).
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import './styles/index.css';
import './styles/blog.css';

// Content layer + page components register themselves on window.
import './data.js';
import './components/Nav.jsx';
import './pages/index.js';

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

const { useState, useEffect } = React;

// Base dir this app is served from (e.g. "/portfolio" on GitHub project pages).
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/+$/, '');

window.navigate = (page) => {
  const url = page === 'home' ? BASE_PATH + '/' : BASE_PATH + '/' + page;
  history.pushState({ page }, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

function Router() {
  const getRoute = () => {
    const rel = window.location.pathname
      .replace(BASE_PATH, '')
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/^index\.html$/, '');
    return rel || 'home';
  };

  const [route, setRoute] = useState(getRoute);
  const page = (route || 'home').split('/')[0] || 'home';

  useEffect(() => {
    const saved = localStorage.getItem('hambn-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const onPop = () => setRoute(getRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const Nav = window.Nav;
  const pages = {
    home: window.Home,
    projects: window.Projects,
    blog: window.Blog,
    links: window.Links,
    resume: window.Resume,
  };
  const Page = pages[page] || window.Home;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Nav page={page} />
      <Page route={route} />
    </div>
  );
}

window.ReactDOM.createRoot(document.getElementById('root')).render(<Router />);
