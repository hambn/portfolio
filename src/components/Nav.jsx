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

  /* ── Desktop layout: centered cluster, theme btn pinned right ── */
  return (
    <nav
      className="site-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Centered group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {/* Brand */}
        <a
          className="nav-brand"
          href={import.meta.env.BASE_URL + ''}
          onClick={goHome}
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: isHome ? 700 : 600,

            textDecoration: 'none',
            letterSpacing: '-0.01em',
            display: 'inline-flex',
            alignItems: 'baseline',
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span
            style={{
              color: isHome ? 'var(--primary)' : 'var(--foreground-faint)',
              fontWeight: 400,
            }}
          >
            ~/
          </span>
          <span style={{ color: 'var(--foreground-faint)', fontWeight: 400 }}>..</span>
          <span
            style={{
              color: isHome ? 'var(--primary)' : 'var(--foreground-faint)',
              fontWeight: 400,
            }}
          >
            /
          </span>
          <span
            style={{
              color: isHome ? 'var(--foreground)' : 'var(--foreground-muted)',
              transition: 'color 150ms',
            }}
          >
            {handle}
          </span>
        </a>

        {navItems.map(({ key, label }) => {
          const active = page === key;
          return (
            <a
              key={key}
              className="nav-item"
              aria-current={active ? 'page' : undefined}
              href={import.meta.env.BASE_URL + key + '/'}
              onClick={go(key)}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
                fontWeight: active ? '700' : '500',
                transition: 'color 150ms',
                fontFamily: 'var(--font-mono)',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  color: active ? 'var(--primary)' : 'var(--foreground-faint)',
                  fontSize: '0.85em',
                }}
              >
                ~/
              </span>
              {label}
            </a>
          );
        })}
      </div>

      {/* Theme toggle — pinned to the right */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          right: '20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--foreground-muted)',
          padding: '6px 8px',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
        }}
        aria-label="toggle theme"
      >
        <span className="theme-dark-icon">☀</span>
        <span className="theme-light-icon">☾</span>
      </button>
    </nav>
  );
}
