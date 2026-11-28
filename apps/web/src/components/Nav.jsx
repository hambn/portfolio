// Nav.jsx — top navigation + theme toggle.
import React from 'react';
import { useContent } from '../hooks/useContent.js';
import { followRoute, routeHref } from '../lib/router.js';
import { storage } from '../lib/storage.js';
import { viewTransition } from '../lib/transition.js';
import Icon from './Icon.jsx';

const NAV_ITEMS = ['projects', 'blog', 'links'];

const THEME_COLOR = { dark: '#09090b', light: '#ffffff' };

// The theme lives on <html data-theme> (set before first paint by index.html)
// and the icons swap in CSS, so toggling needs no React state or re-render.
let switching;
export function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  storage.set('hambn-theme', next);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  // The new theme opens as a circle from the toggle (core.css, theme-reveal).
  const box = document.querySelector('.nav-theme')?.getBoundingClientRect();
  if (box) {
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const reach = Math.hypot(Math.max(x, window.innerWidth - x), window.innerHeight - y);
    root.style.setProperty('--reveal-x', `${x}px`);
    root.style.setProperty('--reveal-y', `${y}px`);
    root.style.setProperty('--reveal-r', `${Math.ceil(reach)}px`);
  }
  const apply = () => {
    root.setAttribute('data-theme', next);
    if (themeColor) themeColor.content = THEME_COLOR[next];
  };
  if (viewTransition('theme', apply)) return;
  // Without view transitions, core.css cross-fades colours while this class
  // is on; ordinary hover transitions keep their own timing after.
  root.classList.add('theme-switching');
  clearTimeout(switching);
  switching = setTimeout(() => root.classList.remove('theme-switching'), 260);
}

export default function Nav({ page }) {
  const { data: profile } = useContent('profile');

  // Everything visual lives in core.css; the active route is expressed as
  // aria-current so CSS and assistive tech read it from the same attribute.
  return (
    <nav className="site-nav">
      {/* The nav's glass and bottom edge, for a page that docks a bar into the
          nav (the links jump bar). Hidden until that page draws its shape;
          the nav paints its own background and border until then. */}
      <div className="nav-surface" aria-hidden="true" />
      <svg className="nav-edge" aria-hidden="true" focusable="false">
        {/* The edge is the shape's outline: a 2px stroke of every part, less
            the filled shape, leaves 1px just outside the union. */}
        <mask
          id="nav-edge-mask"
          maskUnits="userSpaceOnUse"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
        >
          <path className="nav-edge-shape" fill="none" stroke="#fff" strokeWidth="2" />
          <path className="nav-edge-shape" fill="#000" />
        </mask>
        <rect className="nav-edge-line" width="100%" height="100%" mask="url(#nav-edge-mask)" />
      </svg>
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

      <div className="nav-actions">
        <button
          type="button"
          className="nav-palette"
          onClick={() => window.dispatchEvent(new CustomEvent('portfolio:palette'))}
          aria-label="command palette"
          title="command palette (Ctrl+K)"
        >
          <Icon name="search" />
          <kbd aria-hidden="true">:</kbd>
        </button>

        <button
          type="button"
          className="nav-theme"
          onClick={toggleTheme}
          aria-label="toggle theme"
          title="toggle theme (t)"
        >
          <Icon name="sun" className="theme-dark-icon" />
          <Icon name="moon" className="theme-light-icon" />
        </button>
      </div>
    </nav>
  );
}
