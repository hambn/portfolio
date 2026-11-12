// GitLab card. With `apiEndpoint` set in links.json the profile and the year's
// activity come from this site's API; without it, or when the API is down, the
// visitor's browser asks gitlab.com for the profile itself. GitLab's calendar
// cannot be read cross-origin, so the activity graph needs the API and is
// simply left out without it.
import { apiUrl, cardImage } from '../../../lib/api.js';
import './GitLabCard.css';
import React, { useMemo } from 'react';
import { GITLAB_ORIGIN, gitlabPaths } from '@portfolio/shared/gitlab';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { useCardSource } from '../../../hooks/useCardSource.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { ContribGraph, useContributions } from '../../../components/card/ContribGraph.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { BRAND_ICON } from '../brandIcons.js';

const AVATAR = 52;
const ext = { target: '_blank', rel: 'noopener noreferrer' };

const Mark = ({ size, className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
  >
    <path d={BRAND_ICON.gl} />
  </svg>
);

// Both sources answer with GitLab's own one-element user list.
const hasUser = (list) => Array.isArray(list) && Boolean(list[0]?.username);

export const GitLabCard = React.memo(function GitLabCard({ username, url, api = false }) {
  const [collapsed, toggleCollapse] = useCollapsed('gl_card_collapsed');
  const href = url || `${GITLAB_ORIGIN}/${username}`;
  const [copied, copyLink] = useCopy(href);
  const direct = useMemo(
    () =>
      username
        ? async (signal) => {
            const response = await fetch(`${GITLAB_ORIGIN}${gitlabPaths.users(username)}`, {
              signal,
            });
            if (!response.ok) throw new Error(`gitlab ${response.status}`);
            return response.json();
          }
        : null,
    [username],
  );
  const { data, origin, loading } = useCardSource({
    api: api && username ? apiUrl(`/gitlab?username=${encodeURIComponent(username)}`) : null,
    seed: useCardFeed('gitlab'),
    direct,
    enabled: !collapsed,
    cacheKey: username ? `gl:direct:v1:${username}` : null,
    valid: hasUser,
  });
  const profile = data?.[0] || null;
  const activity = useContributions({ host: 'gitlab', username, api, enabled: !collapsed });

  return (
    <div className="gl-card link-card">
      <div className={`gl-head link-card-header${collapsed ? ' is-collapsed' : ''}`}>
        <a href={href} {...ext} className="link-card-brand">
          <Mark size={24} className="gl-mark" />
          <span className="gl-wordmark link-card-title">GitLab</span>
        </a>
        {loading && !profile && <span className="gl-loading">loading…</span>}
        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            accent="var(--gl-accent)"
            copied={copied}
            onCopy={copyLink}
            copyTitle="Copy GitLab profile link"
            href={href}
            openTitle="Open on GitLab"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        data-card="gl"
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="gl-profile">
          {profile?.avatar_url ? (
            <a href={href} {...ext} className="gl-avatar-link">
              <img
                src={cardImage(profile.avatar_url, AVATAR, origin === 'direct')}
                alt={username}
                width={AVATAR}
                height={AVATAR}
                loading="lazy"
                decoding="async"
                className="gl-avatar"
              />
            </a>
          ) : (
            <span className="gl-avatar">
              <Mark size={26} />
            </span>
          )}
          <div className="gl-ident">
            <span className="gl-profile-label">Public profile</span>
            <a href={href} {...ext} className="gl-name">
              {profile?.name || username}
            </a>
            <div className="gl-handle">@{profile?.username || username}</div>
          </div>
          <a href={href} {...ext} className="gl-open">
            <Mark size={13} />
            <span>Profile</span>
          </a>
        </div>
        <ContribGraph data={activity.data} loading={activity.loading} />
      </div>
    </div>
  );
});
