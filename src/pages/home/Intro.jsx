import React from 'react';
import { avatarImage } from '../../lib/api.js';
import { navigate } from '../../lib/router.js';

const AVATAR_SIZE = 72;

const ROUTES = [
  { route: 'projects', label: 'projects', className: 'btn btn-default btn-md' },
  { route: 'blog', label: 'blog', className: 'btn btn-outline btn-md' },
  { route: 'links', label: 'social & contact →', className: 'btn btn-ghost btn-md' },
];

// Avatar, name, handle, the bio paragraphs and the three route buttons.
export default function Intro({ profile }) {
  const paragraphs = profile?.intro?.length ? profile.intro : [profile?.bio].filter(Boolean);
  const avatarSource =
    profile?.avatarSource ||
    (profile?.handle && `https://avatars.githubusercontent.com/${profile.handle}`);

  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
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
          <h1
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}
          >
            {profile?.name || ''}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--primary)' }}>
            @{profile?.handle || ''}
          </p>
        </div>
      </div>

      {/* intro paragraphs — falls back to the one-line bio used for meta/cards */}
      <div
        style={{
          color: 'var(--foreground-muted)',
          fontSize: 'var(--text-base)',
          lineHeight: '1.85',
          // ~70 characters per line — comfortable for multi-sentence paragraphs.
          maxWidth: '620px',
          marginBottom: '36px',
          display: 'grid',
          gap: '18px',
        }}
      >
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '56px' }}>
        {ROUTES.map(({ route, label, className }) => (
          <a
            key={route}
            href={import.meta.env.BASE_URL + route + '/'}
            onClick={(e) => {
              e.preventDefault();
              navigate(route);
            }}
            className={className}
          >
            {label}
          </a>
        ))}
      </div>
    </React.Fragment>
  );
}
