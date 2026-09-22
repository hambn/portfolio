// Nav.jsx — top navigation + theme toggle.
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../lib/data.js';
import { followRoute, routeHref } from '../lib/router.js';
import { storage } from '../lib/storage.js';

const NAV_ITEMS = ['projects', 'blog', 'links'];

// The theme lives on <html data-theme> (set before first paint by index.html)
// and the icons swap in CSS, so toggling needs no React state or re-render.
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  storage.set('hambn-theme', next);
  root.setAttribute('data-theme', next);
}

export default function Nav({ page }) {
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));

  useEffect(() => {
    PortfolioData.getProfile()
      .then(setProfile)
      .catch(() => {});
  }, []);

  // Everything visual lives in core.css; the active route is expressed as
  // aria-current so CSS and assistive tech read it from the same attribute.
  return (
    <nav className="site-nav">
      <div className="nav-group">
        <a
          className="nav-brand"
          aria-current={page === 'home' ? 'page' : undefined}
          href={routeHref('home')}
          onClick={followRoute('home')}
        >
          <span className="nav-brand-sigil nav-brand-path">~/</span>
          <span className="nav-brand-sigil">..</span>
          <span className="nav-brand-sigil nav-brand-path">/</span>
          <span>{profile?.handle || ''}</span>
        </a>

        {NAV_ITEMS.map((key) => (
          <a
            key={key}
            className="nav-item"
            aria-current={page === key ? 'page' : undefined}
            href={routeHref(key)}
            onClick={followRoute(key)}
          >
            <span className="nav-item-sigil">~/</span>
            {key}
          </a>
        ))}
      </div>

      <button className="nav-theme" onClick={toggleTheme} aria-label="toggle theme">
        <span className="theme-dark-icon">☀</span>
        <span className="theme-light-icon">☾</span>
      </button>
    </nav>
  );
}
