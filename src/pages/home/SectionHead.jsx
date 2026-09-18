import React from 'react';

// `$ command` label, a rule across the rest of the line, and an optional link
// on the right, so a section closes itself.
export default function SectionHead({ command, children, action, gap = '16px' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: gap }}>
      <h2 className="section-label">
        <span className="prompt-sigil" aria-hidden="true">
          $
        </span>{' '}
        {command}
        {children}
      </h2>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      {action}
    </div>
  );
}
