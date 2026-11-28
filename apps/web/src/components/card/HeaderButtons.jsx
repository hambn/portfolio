// Copy / open / collapse: clean, subtle controls shared across link card headers.
// Each button inherits its card's own brand font and tint rather than forcing
// portfolio styling onto third-party platform cards.
import React from 'react';
import { EXTERNAL } from '../../lib/external.js';

const GLYPHS = {
  check: <polyline points="20 6 9 17 4 12" />,
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  open: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  chevron: <polyline points="6 9 12 15 18 9" />,
};

const Glyph = ({ name }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={name === 'copy' || name === 'open' ? 1.75 : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {GLYPHS[name]}
  </svg>
);

/** Omit `href` to leave out the open button. `accent` tints the copied state. */
export function HeaderButtons({
  accent,
  copied,
  onCopy,
  copyTitle = 'Copy link',
  href,
  openTitle = 'Open',
  collapsed,
  onToggle,
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCopy}
        className={`link-card-hdr-btn${copied ? ' is-done' : ''}`}
        style={accent ? { '--hdr-accent': accent } : undefined}
        title={copyTitle}
        aria-label={copyTitle}
      >
        <Glyph name={copied ? 'check' : 'copy'} />
        <span className="link-card-hdr-label" aria-live="polite">
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
      {href && (
        <a
          className="link-card-hdr-btn"
          href={href}
          title={openTitle}
          aria-label={openTitle}
          {...(href.startsWith('mailto:') ? {} : EXTERNAL)}
        >
          <Glyph name="open" />
          <span className="link-card-hdr-label">Open</span>
        </a>
      )}
      <span className="link-card-hdr-sep" aria-hidden="true" />
      <button
        type="button"
        onClick={onToggle}
        className="link-card-hdr-btn link-card-hdr-toggle"
        title={collapsed ? 'Expand' : 'Collapse'}
        aria-expanded={!collapsed}
      >
        <Glyph name="chevron" />
      </button>
    </>
  );
}
