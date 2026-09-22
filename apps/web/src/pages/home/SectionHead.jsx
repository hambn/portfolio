import React from 'react';

// `$ command` label, a rule across the rest of the line, and an optional link
// on the right, so a section closes itself.
export default function SectionHead({ command, children, action, gap }) {
  return (
    <div className="section-head" style={gap ? { marginBottom: gap } : undefined}>
      <h2 className="section-label">
        <span className="prompt-sigil" aria-hidden="true">
          $
        </span>{' '}
        {command}
        {children}
      </h2>
      <div className="section-head-rule" />
      {action}
    </div>
  );
}
