import React from 'react';
import Nav from './Nav.jsx';

export default function Shell({ page, children }) {
  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <a href="#content" className="skip-link">
        skip to content
      </a>
      <Nav page={page} />
      <div id="content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
