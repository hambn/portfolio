import { apiUrl, mediaUrl, sizedMedia } from '../../../lib/api.js';
import './GitHubCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { ContribGraph } from '../../../components/card/ContribGraph.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { BRAND_ICON } from '../brandIcons.js';
const GH = {
  bg: 'var(--gh-bg)',
  bgHead: 'var(--gh-bgHead)',
  border: 'var(--gh-border)',
  div: 'var(--gh-div)',
  blue: 'var(--gh-blue)',
  green: 'var(--gh-green)',
  text: 'var(--gh-text)',
  muted: 'var(--gh-muted)',
  faint: 'var(--gh-faint)',
};
const GH_LEVELS = Array.from({ length: 5 }, (_, i) => `var(--gh-level-${i})`);
const GH_GRAPH_THEME = { div: GH.div, faint: GH.faint, muted: GH.muted };
const GH_ICON = BRAND_ICON.gh;
export const GitHubCard = React.memo(function GitHubCard({ username, url }) {
  const [profile, setProfile] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('gh_card_collapsed');
  const href = url || `https://github.com/${username}`;
  const [copied, copyLink] = useCopy(href);
  const { loading } = usePolledJSON(
    username && !collapsed ? apiUrl(`/github?username=${encodeURIComponent(username)}`) : null,
    0,
    (d) => setProfile(d),
    useCardFeed('github'),
  );
  return (
    <div
      style={{
        background: GH.bg,
      }}
      className="gh-style-1 link-card"
    >
      {/* Header */}
      <div
        style={{
          background: GH.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${GH.border}`,
        }}
        className="gh-style-2 link-card-header"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="gh-style-3 link-card-brand"
        >
          <svg viewBox="0 0 24 24" fill={GH.text} width={24} height={24} className="gh-style-4">
            <path d={GH_ICON} />
          </svg>
          <span
            style={{
              color: GH.text,
            }}
            className="gh-style-5 link-card-title"
          >
            GitHub
          </span>
        </a>
        {loading && !profile && (
          <span
            style={{
              color: GH.faint,
            }}
            className="gh-style-6"
          >
            loading…
          </span>
        )}
        <div className="gh-style-7 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn gh-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent={GH.blue}
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy GitHub profile link"
            href={href}
            openLabel="open on github"
            openTitle="Open on GitHub"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      {/* Body */}
      <div
        data-card="gh"
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div
          style={{
            borderBottom: `1px solid ${GH.div}`,
          }}
          className="gh-style-8"
        >
          {profile?.avatar_url ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="gh-style-9">
              <img
                src={sizedMedia(mediaUrl(profile.avatar_url), 52)}
                alt={username}
                width={52}
                height={52}
                loading="lazy"
                decoding="async"
                style={{
                  border: `2px solid ${GH.border}`,
                }}
                className="gh-style-10"
              />
            </a>
          ) : (
            <div
              style={{
                border: `2px solid ${GH.border}`,
              }}
              className="gh-style-11"
            >
              <svg viewBox="0 0 24 24" fill={GH.muted} width={28} height={28}>
                <path d={GH_ICON} />
              </svg>
            </div>
          )}
          <div className="gh-style-12">
            <span className="gh-profile-label">Public profile</span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: GH.text,
              }}
              className="gh-style-13"
            >
              {profile?.name || username}
            </a>
            {profile?.name && (
              <div
                style={{
                  color: GH.muted,
                }}
                className="gh-style-14"
              >
                @{username}
              </div>
            )}
            {profile?.bio && (
              <div
                style={{
                  color: GH.muted,
                }}
                className="gh-style-15"
              >
                {profile.bio}
              </div>
            )}
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: GH.green,
            }}
            className="gh-style-16"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width={13}
              height={13}
              className="gh-style-17"
            >
              <path d={GH_ICON} />
            </svg>
            <span>Follow</span>
          </a>
        </div>
        {profile && (
          <div className="gh-style-18">
            {[
              ['repositories', profile.public_repos],
              ['followers', profile.followers],
              ['following', profile.following],
            ].map(([k, v]) => (
              <a
                key={k}
                href={`${href}?tab=${k}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gh-style-19"
              >
                <span className="gh-style-20">{(v ?? 0).toLocaleString()}</span>
                <span
                  style={{
                    color: GH.faint,
                  }}
                  className="gh-style-21"
                >
                  {k}
                </span>
              </a>
            ))}
          </div>
        )}
        {profile && profile.login && (
          <ContribGraph
            username={username}
            source="github"
            levels={GH_LEVELS}
            theme={GH_GRAPH_THEME}
          />
        )}
      </div>
    </div>
  );
});
