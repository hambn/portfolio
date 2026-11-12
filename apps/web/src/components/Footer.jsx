// Footer.jsx — the status line under every page: which commit is deployed,
// the time in UTC, and the keyboard shortcuts.
import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Keys from './Keys.jsx';

export const REPO = 'https://github.com/hambn/portfolio';
// Set at build time by scripts/build-info.mjs; empty without a git checkout.
const SHA = import.meta.env.VITE_BUILD_SHA || '';
const DATE = import.meta.env.VITE_BUILD_DATE || '';

// The time on-call rotas and logs are written in. Empty until the page is
// interactive: the prerendered HTML cannot know what time it will be read.
function UtcClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 16));
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="site-footer-clock" title="coordinated universal time">
      {time && `${time} utc`}
    </span>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <a
        className="site-footer-build"
        href={SHA ? `${REPO}/commit/${SHA}` : REPO}
        target="_blank"
        rel="noopener noreferrer"
        title="the commit this site was built from"
      >
        <Icon name="git-commit" />
        {SHA || 'source'}
        {DATE && <span>{DATE}</span>}
      </a>
      <div className="site-footer-side">
        <UtcClock />
        <Keys />
      </div>
    </footer>
  );
}
