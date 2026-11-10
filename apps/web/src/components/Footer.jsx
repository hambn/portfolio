// Footer.jsx — the status line under every page: which commit is deployed.
import React from 'react';
import Icon from './Icon.jsx';

const REPO = 'https://github.com/hambn/portfolio';
// Set at build time by scripts/build-info.mjs; empty without a git checkout.
const SHA = import.meta.env.VITE_BUILD_SHA || '';
const DATE = import.meta.env.VITE_BUILD_DATE || '';

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
    </footer>
  );
}
