import { cardImage } from '../../../lib/api.js';
import './GitHubCard.css';
import React from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { ContribGraph, useContributions } from '../../../components/card/ContribGraph.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { langColor } from '../../../lib/languages.js';
import { BRAND_ICON } from '../brandIcons.js';
import { OCTICON } from './octicons.js';
import { useGitHubProfile } from './useGitHubProfile.js';

const GH_ICON = BRAND_ICON.gh;
const AVATAR = 96;

const joined = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });
const format = (formatter, iso) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? formatter.format(date) : null;
};

function Octicon({ name, size = 16, className = 'gh-octicon' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d={OCTICON[name]} />
    </svg>
  );
}

const ext = { target: '_blank', rel: 'noopener noreferrer' };

// A website as the profile lists it: an http(s) URL, shown without its scheme.
function website(blog) {
  if (!blog) return null;
  const href = /^https?:\/\//i.test(blog) ? blog : `https://${blog}`;
  try {
    const url = new URL(href);
    if (!/^https?:$/.test(url.protocol)) return null;
    return { href: url.href, label: `${url.host}${url.pathname}`.replace(/\/$/, '') };
  } catch {
    return null;
  }
}

function Pinned({ repos, username, title }) {
  if (!repos.length) return null;
  return (
    <section className="gh-section" aria-label={`${title} repositories`}>
      <h3 className="gh-h">{title}</h3>
      <ul className="gh-pinned">
        {repos.map((repo) => (
          <li key={`${repo.owner}/${repo.name}`} className="gh-box gh-pin">
            <div className="gh-pin-head">
              <Octicon name="repo" />
              <a href={repo.url} {...ext} className="gh-pin-name">
                {repo.owner !== username && <span className="gh-pin-owner">{repo.owner}/</span>}
                {repo.name}
              </a>
              {repo.label && <span className="gh-label">{repo.label}</span>}
            </div>
            {repo.description && <p className="gh-pin-desc">{repo.description}</p>}
            <p className="gh-pin-meta">
              {repo.language && (
                <span className="gh-lang">
                  <span
                    className="gh-lang-dot"
                    style={{ background: repo.color || langColor(repo.language) }}
                  />
                  {repo.language}
                </span>
              )}
              {repo.forks > 0 && (
                <a href={`${repo.url}/forks`} {...ext} className="gh-pin-stat">
                  <Octicon name="repoForked" />
                  {repo.forks.toLocaleString()}
                </a>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Languages({ languages, href }) {
  const total = languages.reduce((sum, language) => sum + language.repos, 0);
  if (!total) return null;
  const share = (language) => (language.repos / total) * 100;
  return (
    <div className="gh-extra">
      <h3 className="gh-extra-h">Languages</h3>
      <div className="gh-langbar" role="img" aria-label="Repository languages">
        {languages.map((language) => (
          <span
            key={language.name}
            style={{ width: `${share(language)}%`, background: langColor(language.name) }}
          />
        ))}
      </div>
      <ul className="gh-langs">
        {languages.map((language) => (
          <li key={language.name}>
            <a
              href={`${href}?tab=repositories&language=${encodeURIComponent(language.name.toLowerCase())}`}
              {...ext}
            >
              <span className="gh-lang-dot" style={{ background: langColor(language.name) }} />
              <span className="gh-langs-name">{language.name}</span>
              <span className="gh-langs-pct">{share(language).toFixed(1)}%</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Achievements({ achievements, href, image }) {
  if (!achievements.length) return null;
  return (
    <div className="gh-extra">
      <h3 className="gh-extra-h">
        <a href={`${href}?tab=achievements`} {...ext} className="gh-h-plain">
          Achievements
        </a>
      </h3>
      <ul className="gh-badges">
        {achievements.map((badge) => (
          <li key={badge.slug}>
            <a
              href={`${href}?achievement=${badge.slug}&tab=achievements`}
              {...ext}
              className="gh-badge"
              title={badge.count ? `${badge.name} ${badge.count}` : badge.name}
            >
              {badge.image ? (
                <img
                  src={image(badge.image)}
                  alt={`Achievement: ${badge.name}`}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="gh-badge-empty">{badge.name.slice(0, 1)}</span>
              )}
              {badge.count && (
                <span className={`gh-badge-tier gh-tier-${badge.tier || 'default'}`}>
                  {badge.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Organizations({ organizations, image }) {
  if (!organizations.length) return null;
  return (
    <div className="gh-extra">
      <h3 className="gh-extra-h">Organizations</h3>
      <ul className="gh-orgs">
        {organizations.map((org) => (
          <li key={org.login}>
            <a href={org.url} {...ext} title={org.login}>
              {org.image ? (
                <img
                  src={image(org.image, 32)}
                  alt={org.login}
                  width={32}
                  height={32}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Octicon name="organization" size={20} />
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Placeholder bars in the profile's shape while the first answer is on its way.
function Skeleton() {
  return (
    <div className="gh-skeleton" aria-hidden="true">
      <span style={{ width: '70%' }} />
      <span style={{ width: '45%' }} />
      <span style={{ width: '88%' }} />
    </div>
  );
}

export const GitHubCard = React.memo(function GitHubCard({ username, url, api = false }) {
  const [collapsed, toggleCollapse] = useCollapsed('gh_card_collapsed');
  const href = url || `https://github.com/${username}`;
  const [copied, copyLink] = useCopy(href);
  const { profile, direct, loading } = useGitHubProfile({ username, api, enabled: !collapsed });
  const contributions = useContributions({
    host: 'github',
    username,
    api,
    enabled: !collapsed && Boolean(profile?.login),
  });
  // Through the media proxy when the API supplied the card, straight from
  // GitHub when the visitor's browser did.
  const image = (source, size) => cardImage(source, size, direct);
  const page = profile?.page || null;
  const status = page?.status || null;
  const site = website(profile?.blog);
  const since = format(joined, profile?.created_at);
  const login = profile?.login || username;
  // The pinned repositories, from the profile page (API) or the pinned-repos
  // service (direct); the most starred stand in only when neither answered.
  const pinned = page?.pinned?.length ? page.pinned : profile?.pinned || [];
  const repos = pinned.length ? pinned : profile?.popular || [];
  return (
    <div className="gh-card link-card">
      {/* Header */}
      <div className={`gh-head link-card-header${collapsed ? ' is-collapsed' : ''}`}>
        <a href={href} {...ext} className="gh-brand link-card-brand">
          <svg viewBox="0 0 24 24" fill="currentColor" width={24} height={24} className="gh-mark">
            <path d={GH_ICON} />
          </svg>
          <span className="gh-wordmark link-card-title">GitHub</span>
        </a>
        {loading && !profile && <span className="gh-loading">loading…</span>}
        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            accent="var(--gh-accent)"
            copied={copied}
            onCopy={copyLink}
            copyTitle="Copy GitHub profile link"
            href={href}
            openTitle="Open on GitHub"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      {/* Body: the profile as github.com stacks it on a narrow screen, which
          leaves the pinned repositories and the year's graph the full width. */}
      <div
        data-card="gh"
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="gh-body">
          <div className="gh-profile">
            <a href={href} {...ext} className="gh-avatar-link" aria-label={`${login} on GitHub`}>
              {profile?.avatar_url ? (
                <img
                  src={image(profile.avatar_url, AVATAR)}
                  alt=""
                  width={AVATAR}
                  height={AVATAR}
                  loading="lazy"
                  decoding="async"
                  className="gh-avatar"
                />
              ) : (
                <span className="gh-avatar gh-avatar-empty">
                  <svg viewBox="0 0 24 24" fill="currentColor" width={40} height={40}>
                    <path d={GH_ICON} />
                  </svg>
                </span>
              )}
              {status?.emoji && (
                <span className="gh-status-bubble" title={status.message || undefined}>
                  <span aria-hidden="true">{status.emoji}</span>
                  {status.message && <span className="gh-status-text">{status.message}</span>}
                </span>
              )}
            </a>
            <div className="gh-ident">
              <a href={href} {...ext} className="gh-name">
                {profile?.name || login}
              </a>
              <div className="gh-login">{login}</div>
            </div>
            <a href={href} {...ext} className="gh-btn gh-follow">
              Follow
            </a>
          </div>

          {!profile && loading && <Skeleton />}

          {profile && (
            <>
              {profile.bio && <p className="gh-bio">{profile.bio}</p>}
              <ul className="gh-details">
                <li className="gh-social">
                  <Octicon name="people" />
                  <a href={`${href}?tab=followers`} {...ext}>
                    <strong>{(profile.followers ?? 0).toLocaleString()}</strong> followers
                  </a>
                  <span aria-hidden="true">·</span>
                  <a href={`${href}?tab=following`} {...ext}>
                    <strong>{(profile.following ?? 0).toLocaleString()}</strong> following
                  </a>
                </li>
                {profile.company && (
                  <li>
                    <Octicon name="organization" />
                    <span>{profile.company}</span>
                  </li>
                )}
                {profile.location && (
                  <li>
                    <Octicon name="location" />
                    <span>{profile.location}</span>
                  </li>
                )}
                {site && (
                  <li>
                    <Octicon name="link" />
                    <a href={site.href} target="_blank" rel="noopener noreferrer me">
                      {site.label}
                    </a>
                  </li>
                )}
                {profile.twitter_username && (
                  <li>
                    <svg
                      viewBox="0 0 24 24"
                      width={14}
                      height={14}
                      fill="currentColor"
                      aria-hidden="true"
                      className="gh-octicon"
                    >
                      <path d={BRAND_ICON.x} />
                    </svg>
                    <a href={`https://x.com/${profile.twitter_username}`} {...ext}>
                      @{profile.twitter_username}
                    </a>
                  </li>
                )}
                {since && (
                  <li>
                    <Octicon name="calendar" />
                    <span>Joined {since}</span>
                  </li>
                )}
              </ul>
            </>
          )}

          <div className="gh-tabs">
            <a href={href} {...ext} className="gh-tab is-current">
              <Octicon name="book" />
              Overview
            </a>
            <a href={`${href}?tab=repositories`} {...ext} className="gh-tab">
              <Octicon name="repo" />
              Repositories
              {profile?.public_repos != null && (
                <span className="gh-counter">{profile.public_repos.toLocaleString()}</span>
              )}
            </a>
            <a href={`${href}?tab=stars`} {...ext} className="gh-tab">
              <Octicon name="star" />
              Stars
            </a>
          </div>

          {page?.readme && (
            <section className="gh-section" aria-label="Profile README">
              <div className="gh-box gh-readme">
                <div className="gh-readme-path">
                  <a href={`https://github.com/${login}/${login}`} {...ext}>
                    {login}
                  </a>
                  <span> / </span>README<span className="gh-muted">.md</span>
                </div>
                <p className="gh-readme-body">{page.readme}</p>
              </div>
            </section>
          )}

          <Pinned
            repos={repos}
            username={login}
            title={pinned.length ? 'Pinned' : 'Popular repositories'}
          />

          <ContribGraph
            data={contributions.data}
            loading={contributions.loading}
            help="https://docs.github.com/articles/why-are-my-contributions-not-showing-up-on-my-profile"
            boxed
          />

          {profile && (
            <div className="gh-extras">
              <Languages languages={profile.languages || []} href={href} />
              <Achievements achievements={page?.achievements || []} href={href} image={image} />
              <Organizations organizations={page?.organizations || []} image={image} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
