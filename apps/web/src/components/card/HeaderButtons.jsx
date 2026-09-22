// Copy / open / collapse button trio shared by every link card header.
import React from 'react';

const CheckIcon = ({ color }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="14"
    height="14"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="14"
    height="14"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const ExternalIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="14"
    height="14"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const ChevronIcon = ({ collapsed }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="15"
    height="15"
    style={{
      transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      transition: 'transform 0.25s',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/** The copy / open / collapse button trio every card header shares.
 *  Omit `href` to skip the open button (e.g. EmailCard). */
export function HeaderButtons({
  btnClass,
  labelClass,
  accent,
  copied,
  onCopy,
  copyLabel = 'copy link',
  copyTitle = 'Copy link',
  href,
  openLabel = 'open',
  openTitle = 'Open',
  collapsed,
  onToggle,
}) {
  return (
    <>
      <button onClick={onCopy} className={btnClass} title={copyTitle}>
        {copied ? <CheckIcon color={accent} /> : <CopyIcon />}
        <span className={labelClass} style={{ color: copied ? accent : 'inherit' }}>
          {copied ? 'copied!' : copyLabel}
        </span>
      </button>
      {href && (
        <button
          className={btnClass}
          title={openTitle}
          onClick={() =>
            // mailto: has no page to open in a tab — hand it to the OS handler.
            href.startsWith('mailto:')
              ? (window.location.href = href)
              : window.open(href, '_blank', 'noopener,noreferrer')
          }
        >
          <ExternalIcon />
          <span className={labelClass}>{openLabel}</span>
        </button>
      )}
      <button
        onClick={onToggle}
        className={btnClass}
        title={collapsed ? 'Expand' : 'Collapse'}
        style={{ padding: '4px 5px' }}
      >
        <ChevronIcon collapsed={collapsed} />
      </button>
    </>
  );
}
