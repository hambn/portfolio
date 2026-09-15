// Small shared pieces for the blog views: date formatting, tag chips, URL state.
import React, { useState } from 'react';
import { navigate } from '../../lib/router.js';

export const fmtDate = (d) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  const date = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
};

export const InlineCode = ({ children }) => (
  <code style={{
    background: 'var(--background-muted)', padding: '1px 6px',
    borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)',
    color: 'var(--foreground-muted)', border: '1px solid var(--border)',
  }}>{children}</code>
);

// A tag chip that navigates to the blog list filtered by that tag.
export const ClickableTag = ({ children, onClick }) => {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
        background: h ? 'var(--primary-subtle)' : 'var(--background-muted)',
        color: h ? 'var(--primary)' : 'var(--foreground-subtle)',
        borderRadius: 'var(--radius-sm)', padding: '2px 8px',
        border: `1px solid ${h ? 'var(--primary-ring)' : 'var(--border)'}`,
        whiteSpace: 'nowrap', transition: 'all var(--transition-base)',
      }}
    >{children}</button>
  );
};

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
    .split(',').map(s => s.trim()).filter(Boolean);
