import React from 'react';
import Icon from '../../components/Icon.jsx';

const SHOWN = ['github', 'x', 'telegram'];
const ICONS = { github: 'github', x: 'x-brand', telegram: 'telegram' };

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
          className="home-footer-link"
        >
          <Icon name={ICONS[key]} />
          {key}
          <Icon name="arrow-up-right" className="icon-nudge is-out" />
        </a>
      ))}
    </div>
  );
}
