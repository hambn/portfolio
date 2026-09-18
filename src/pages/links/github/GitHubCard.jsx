import { apiUrl, mediaUrl } from '../../../lib/api.js';
import './GitHubCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { ContribGraph } from '../../../components/card/ContribGraph.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const GH = {
  bg: 'var(--gh-bg)',
  bgHead: 'var(--gh-bgHead)',
  border: 'var(--gh-border)',
  div: 'var(--gh-div)',
  blue: 'var(--gh-blue)',
  green: 'var(--gh-green)',
  greenH: 'var(--gh-greenH)',
  text: 'var(--gh-text)',
  muted: 'var(--gh-muted)',
  faint: 'var(--gh-faint)',
};
const GH_LEVELS = Array.from({ length: 5 }, (_, i) => `var(--gh-level-${i})`);
const GH_ICON =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';
export function GitHubCard({ username, url }) {
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
        border: `1px solid ${GH.border}`,
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
                src={mediaUrl(profile.avatar_url)}
                alt={username}
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
                onMouseEnter={(e) =>
                  (e.currentTarget.querySelector('.gh-sv').style.color = GH.blue)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.querySelector('.gh-sv').style.color = GH.text)
                }
                className="gh-style-19"
              >
                <span
                  className="gh-sv gh-style-20"
                  style={{
                    color: GH.text,
                  }}
                >
                  {(v ?? 0).toLocaleString()}
                </span>
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
            theme={{
              div: GH.div,
              faint: GH.faint,
              muted: GH.muted,
            }}
          />
        )}
      </div>
    </div>
  );
}
