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
import './pages/Home.jsx';
import './pages/Projects.jsx';
import './pages/blog/Blog.jsx';
import './pages/links/Links.jsx'; // pulls in its own card components
import './pages/Resume.jsx';

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
