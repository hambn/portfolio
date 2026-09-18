// Small shared pieces for the blog views: date formatting, tag chips, URL state.
import React from 'react';
import { navigate } from '../../lib/router.js';

export const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  const date = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const InlineCode = ({ children }) => (
  <code
    style={{
      background: 'var(--background-muted)',
      padding: '1px 6px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      color: 'var(--foreground-muted)',
      border: '1px solid var(--border)',
    }}
  >
    {children}
  </code>
);

// A tag chip that navigates to the blog list filtered by that tag.
export const ClickableTag = ({ children, onClick }) => (
  <button className="blog-tag" onClick={onClick}>
    {children}
  </button>
);

// Jump to the blog list, filtered to a single tag (state lives in the URL).
export const goToTag = (tag, e) => {
  if (e) {
    // The chip can live inside a stretched <a> row — cancel its navigation.
    e.preventDefault();
    e.stopPropagation();
  }
  navigate('blog?tag=' + encodeURIComponent(tag));
};

export const readUrlTags = () =>
  (new URLSearchParams(window.location.search).get('tag') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
