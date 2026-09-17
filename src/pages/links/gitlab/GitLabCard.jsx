import { apiUrl, mediaUrl } from '../../../lib/api.js';
import './GitLabCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { ContribGraph } from '../../../components/card/ContribGraph.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const GL = {
  bg: 'var(--gl-bg)',
  bgHead: 'var(--gl-bgHead)',
  border: 'var(--gl-border)',
  div: 'var(--gl-div)',
  orange: 'var(--gl-orange)',
  orangeH: 'var(--gl-orangeH)',
  red: 'var(--gl-red)',
  text: 'var(--gl-text)',
  muted: 'var(--gl-muted)',
  faint: 'var(--gl-faint)',
  action: 'var(--gl-action)',
  actionHover: 'var(--gl-actionHover)',
  accent: 'var(--gl-accent)',
};
const GL_LEVELS = Array.from({ length: 5 }, (_, i) => `var(--gl-level-${i})`);
const GL_ICON =
  'M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.185.84 4.05 1.263L1.386 9.452.044 13.587c-.121.375.014.789.331 1.023L12 23.054l11.625-8.443c.318-.235.453-.647.33-1.024';
export function GitLabCard({ username, url }) {
  const [profile, setProfile] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('gl_card_collapsed');
  const href = url || `https://gitlab.com/${username}`;
  const [copied, copyLink] = useCopy(href);
  const { loading } = usePolledJSON(
    username && !collapsed ? apiUrl(`/gitlab?username=${encodeURIComponent(username)}`) : null,
    0,
    (d) => setProfile(Array.isArray(d) ? d[0] : null),
  );
  return (
    <div
      style={{
        background: GL.bg,
        border: `1px solid ${GL.border}`,
      }}
      className="gl-style-1 link-card"
    >
      {/* Header */}
      <div
        style={{
          background: GL.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${GL.border}`,
        }}
        className="gl-style-2 link-card-header"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="gl-style-3 link-card-brand"
        >
          <svg viewBox="0 0 24 24" fill={GL.orange} width={24} height={24} className="gl-style-4">
            <path d={GL_ICON} />
          </svg>
          <span
            style={{
              color: GL.text,
            }}
            className="gl-style-5 link-card-title"
          >
            GitLab
          </span>
        </a>
        {loading && !profile && (
          <span
            style={{
              color: GL.faint,
            }}
            className="gl-style-6"
          >
            loading…
          </span>
        )}
        <div className="gl-style-7 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn gl-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent={GL.accent}
            copied={copied}
            onCopy={copyLink}
            href={href}
            openTitle="Open on GitLab"
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
            borderBottom: `1px solid ${GL.div}`,
          }}
          className="gl-style-8"
        >
          {profile?.avatar_url ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="gl-style-9">
              <img
                src={mediaUrl(profile.avatar_url)}
                alt={username}
                style={{
                  border: `2px solid ${GL.border}`,
                }}
                className="gl-style-10"
              />
            </a>
          ) : (
            <div
              style={{
                border: `2px solid ${GL.border}`,
              }}
              className="gl-style-11"
            >
              <svg viewBox="0 0 24 24" fill={GL.orange} width={26} height={26}>
                <path d={GL_ICON} />
              </svg>
            </div>
          )}
          <div className="gl-style-12">
            <span className="gl-profile-label">Public profile</span>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: GL.text,
              }}
              className="gl-style-13"
            >
              {profile?.name || username}
            </a>
            <div
              style={{
                color: GL.muted,
              }}
              className="gl-style-14"
            >
              @{profile?.username || username}
            </div>
            {profile?.bio && (
              <div
                style={{
                  color: GL.muted,
                }}
                className="gl-style-15"
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
              background: GL.action,
            }}
            className="gl-style-16"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width={13}
              height={13}
              className="gl-style-17"
            >
              <path d={GL_ICON} />
            </svg>
            <span>Profile</span>
          </a>
        </div>
        <ContribGraph
          username={username}
          source="gitlab"
          levels={GL_LEVELS}
          theme={{
            div: GL.div,
            faint: GL.faint,
            muted: GL.muted,
          }}
        />
      </div>
    </div>
  );
}
