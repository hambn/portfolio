import React from 'react';
import { avatarImage } from '../../lib/api.js';
import { followRoute, routeHref } from '../../lib/router.js';
import { useSiteCard } from '../../lib/siteFeed.js';
import Icon from '../../components/Icon.jsx';

const AVATAR_SIZE = 72;
const ACTIVE_PRESENCE = new Set(['online', 'idle', 'dnd']);
const STATUS_LABEL = { online: 'online', idle: 'idle', dnd: 'do not disturb' };

const ROUTES = [
  { route: 'projects', label: 'projects', className: 'btn btn-default btn-md' },
  { route: 'blog', label: 'blog', className: 'btn btn-outline btn-md' },
  { route: 'links', label: 'social & contact', arrow: true, className: 'btn btn-ghost btn-md' },
];

/** The avatar's `<img>` src/srcSet; home/warm.js fetches the same files ahead. */
export function introAvatar(profile) {
  const source =
    profile?.avatarSource ||
    (profile?.handle && `https://avatars.githubusercontent.com/${profile.handle}`);
  return avatarImage(source, AVATAR_SIZE);
}

// Avatar, name, handle, the bio paragraphs and the three route buttons.
export default function Intro({ profile }) {
  // falls back to the one-line bio used for meta/cards
  const paragraphs = profile?.intro?.length ? profile.intro : [profile?.bio].filter(Boolean);
  // Piggybacks on the visit's single /site batch (zero extra requests).
  // Stays unrendered until real presence arrives so SSR matches hydration.
  const discord = useSiteCard('discord');
  const status = discord.status === 'ready' ? discord.data?.status : null;
  const activity =
    discord.status === 'ready'
      ? discord.data?.activities?.find((a) => a.type === 0 || a.type === 2)?.name
      : null;
  const livePresence = ACTIVE_PRESENCE.has(status) ? status : null;
  const presenceTitle = livePresence
    ? `${STATUS_LABEL[livePresence]}${activity ? ` — ${activity}` : ' on discord'}`
    : '';

  return (
    <React.Fragment>
      <div className="home-hero">
        <div className="home-avatar-wrap">
          {/* fetchPriority high: this is the home page's LCP candidate, and React
              hoists a matching <link rel="preload"> into the prerendered <head>. */}
          <img
            {...introAvatar(profile)}
            alt={profile?.name || ''}
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            decoding="async"
            fetchPriority="high"
            className="home-avatar"
          />
          {livePresence && (
            <a
              href={`${routeHref('links')}#card-dc`}
              onClick={followRoute('links')}
              className={`home-presence is-${livePresence}`}
              title={presenceTitle}
              aria-label={presenceTitle}
            />
          )}
        </div>
        <div>
          <h1 className="home-name">{profile?.name || ''}</h1>
          <p className="home-handle">
            @{profile?.handle || ''}
            {profile?.title && <span className="home-role">{profile.title}</span>}
          </p>
        </div>
      </div>

      <div className="home-intro">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div className="home-actions">
        {ROUTES.map(({ route, label, arrow, className }) => (
          <a key={route} href={routeHref(route)} onClick={followRoute(route)} className={className}>
            {label}
            {arrow && <Icon name="arrow-right" className="icon-nudge" />}
          </a>
        ))}
      </div>
    </React.Fragment>
  );
}
