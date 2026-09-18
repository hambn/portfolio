import React from 'react';

const SHOWN = ['github', 'x', 'telegram'];

// Footer quick-links — driven by links.json so no duplication.
export default function FooterLinks({ links }) {
  const shown = links ? SHOWN.filter((k) => links[k]) : [];
  if (!shown.length) return null;

  return (
    <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {shown.map((key) => (
          <a
            key={key}
            href={links[key].url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-quiet"
            style={{ fontSize: 'var(--text-xs)' }}
          >
            {key} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
