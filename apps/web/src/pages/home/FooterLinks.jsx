import React from 'react';

const SHOWN = ['github', 'x', 'telegram'];

// Footer quick-links — driven by links.json so no duplication.
export default function FooterLinks({ links }) {
  const shown = links ? SHOWN.filter((k) => links[k]) : [];
  if (!shown.length) return null;

  return (
    <div className="home-footer">
      {shown.map((key) => (
        <a
          key={key}
          href={links[key].url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-quiet"
        >
          {key} ↗
        </a>
      ))}
    </div>
  );
}
