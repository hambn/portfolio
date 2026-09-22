import React from 'react';
import { avatarImage } from '../../lib/api.js';
import { followRoute, routeHref } from '../../lib/router.js';

const AVATAR_SIZE = 72;

const ROUTES = [
  { route: 'projects', label: 'projects', className: 'btn btn-default btn-md' },
  { route: 'blog', label: 'blog', className: 'btn btn-outline btn-md' },
  { route: 'links', label: 'social & contact →', className: 'btn btn-ghost btn-md' },
];

// Avatar, name, handle, the bio paragraphs and the three route buttons.
export default function Intro({ profile }) {
  // falls back to the one-line bio used for meta/cards
  const paragraphs = profile?.intro?.length ? profile.intro : [profile?.bio].filter(Boolean);
  const avatarSource =
    profile?.avatarSource ||
    (profile?.handle && `https://avatars.githubusercontent.com/${profile.handle}`);

  return (
    <React.Fragment>
      <div className="home-hero">
        {/* fetchPriority high: this is the home page's LCP candidate, and React
            hoists a matching <link rel="preload"> into the prerendered <head>. */}
        <img
          {...avatarImage(avatarSource, AVATAR_SIZE)}
          alt={profile?.name || ''}
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          decoding="async"
          fetchPriority="high"
          className="home-avatar"
        />
        <div>
          <h1 className="home-name">{profile?.name || ''}</h1>
          <p className="home-handle">@{profile?.handle || ''}</p>
        </div>
      </div>

      <div className="home-intro">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="home-actions">
        {ROUTES.map(({ route, label, className }) => (
          <a key={route} href={routeHref(route)} onClick={followRoute(route)} className={className}>
            {label}
          </a>
        ))}
      </div>
    </React.Fragment>
  );
}
