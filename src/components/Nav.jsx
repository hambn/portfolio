// Nav.jsx — top navigation + theme toggle.
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../lib/data.js';
import { navigate } from '../lib/router.js';
import { storage } from '../lib/storage.js';

export default function Nav({ page }) {
  const [theme, setTheme] = useState('dark');
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));
  const isHome = page === 'home';

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    PortfolioData.getProfile()
      .then(setProfile)
      .catch(() => {});
  }, []);

  const handle = profile?.handle || '';

  const navItems = [
    { key: 'projects', label: 'projects' },
    { key: 'blog', label: 'blog' },
    { key: 'links', label: 'links' },
  ];

  const go = (key) => (e) => {
    e.preventDefault();
    navigate(key);
  };

  const goHome = (e) => {
    e.preventDefault();
    navigate('home');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    storage.set('hambn-theme', next);
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  /* ── Desktop layout: centered cluster, theme btn pinned right ──
     Everything visual lives in core.css; the active route is expressed as
     aria-current so CSS and assistive tech read it from the same attribute. */
  return (
    <nav className="site-nav">
      <div className="nav-group">
        <a
          className="nav-brand"
          aria-current={isHome ? 'page' : undefined}
          href={import.meta.env.BASE_URL + ''}
          onClick={goHome}
        >
          <span className="nav-brand-sigil nav-brand-path">~/</span>
          <span className="nav-brand-sigil">..</span>
          <span className="nav-brand-sigil nav-brand-path">/</span>
          <span>{handle}</span>
        </a>

        {navItems.map(({ key, label }) => (
          <a
            key={key}
            className="nav-item"
            aria-current={page === key ? 'page' : undefined}
            href={import.meta.env.BASE_URL + key + '/'}
            onClick={go(key)}
          >
            <span className="nav-item-sigil">~/</span>
            {label}
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
