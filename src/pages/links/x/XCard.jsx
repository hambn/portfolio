import './XCard.css';
import React, { useState } from 'react';
import { apiUrl } from '../../../lib/api.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { xUsername } from '../../../../shared/x.js';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const X_ICON =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const LINK_ICON =
  'M18.36 5.64c-1.95-1.96-5.11-1.96-7.07 0L9.88 7.05 8.46 5.64l1.42-1.42c2.73-2.73 7.16-2.73 9.9 0 2.73 2.74 2.73 7.17 0 9.9l-1.42 1.42-1.41-1.42 1.41-1.41c1.96-1.96 1.96-5.12 0-7.07zm-2.12 3.53l-7.07 7.07-1.41-1.41 7.07-7.07 1.41 1.41zm-12.02.71l1.42-1.42 1.41 1.42-1.41 1.41c-1.96 1.96-1.96 5.12 0 7.07 1.95 1.96 5.11 1.96 7.07 0l1.41-1.41 1.42 1.41-1.42 1.42c-2.73 2.73-7.16 2.73-9.9 0-2.73-2.74-2.73-7.17 0-9.9z';
const CALENDAR_ICON =
  'M7 4V3h2v1h6V3h2v1h1.5C19.89 4 21 5.12 21 6.5v12c0 1.38-1.11 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-12C3 5.12 4.12 4 5.5 4H7zm0 2H5.5c-.27 0-.5.22-.5.5v12c0 .28.23.5.5.5h13c.28 0 .5-.22.5-.5v-12c0-.28-.22-.5-.5-.5H17v1h-2V6H9v1H7V6zm0 4h10v2H7v-2z';
export function XCard({ handle, username, url, apiEndpoint }) {
  const configuredUsername = xUsername(username || handle || url);
  return (
    <XProfile key={configuredUsername} username={configuredUsername} apiEndpoint={apiEndpoint} />
  );
}

function XProfile({ username, apiEndpoint }) {
  const [profile, setProfile] = useState(null);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const [failedBanner, setFailedBanner] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('x_card_collapsed');
  const href = username ? `https://x.com/${username}` : 'https://x.com';
  const endpoint = new URL(
    apiEndpoint || apiUrl('/x'),
    globalThis.location?.origin || 'https://api.portfolio.hgh.dev',
  );
  endpoint.searchParams.set('username', username || '');
  const { loading, error } = usePolledJSON(
    username && !collapsed ? endpoint.href : null,
    3600000,
    (data) => {
      if (data?.username === username) setProfile(data);
    },
    useCardFeed('x'),
  );
  const avatar = profile?.avatar ? new URL(profile.avatar, endpoint).href : null;
  const banner = profile?.banner ? new URL(profile.banner, endpoint).href : null;
  const [copied, copyLink] = useCopy(href);
  return (
    <div
      style={{
        background: 'var(--x-bg)',
        border: '1px solid var(--x-border)',
      }}
      className="x-style-1 link-card"
    >
      <div
        style={{
          background: 'var(--x-bgHead)',
          borderBottom: collapsed ? 'none' : '1px solid var(--x-border)',
        }}
        className="x-style-2 link-card-header"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="x-style-3 link-card-brand"
        >
          <svg
            viewBox="0 0 24 24"
            fill="var(--x-text)"
            width={24}
            height={24}
            className="x-style-4"
          >
            <path d={X_ICON} />
          </svg>
          <span
            style={{
              color: 'var(--x-text)',
            }}
            className="x-style-5 link-card-title"
          >
            X
          </span>
        </a>
        <div className="x-style-6 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn x-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent="var(--x-blue)"
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy X profile link"
            href={href}
            openLabel="open on x"
            openTitle="Open on X"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="x-banner-wrap">
          {banner && banner !== failedBanner ? (
            <img className="x-banner" src={banner} alt="" onError={() => setFailedBanner(banner)} />
          ) : (
            <div className="x-banner x-banner-empty" />
          )}
        </div>
        <div className="x-profile" aria-busy={loading && !profile}>
          <div className="x-actions-row">
            <a href={href} target="_blank" rel="noopener noreferrer" className="x-avatar-ring">
              {avatar && avatar !== failedAvatar ? (
                <img
                  className="x-avatar"
                  src={avatar}
                  alt=""
                  onError={() => setFailedAvatar(avatar)}
                />
              ) : (
                <svg viewBox="0 0 24 24" fill="var(--x-text)" className="x-avatar-fallback">
                  <path d={X_ICON} />
                </svg>
              )}
            </a>
            <a href={href} target="_blank" rel="noopener noreferrer" className="x-follow">
              <svg viewBox="0 0 24 24" fill="currentColor" width={13} height={13}>
                <path d={X_ICON} />
              </svg>
              <span>Follow</span>
            </a>
          </div>
          <div className="x-identity">
            <div className="x-name" dir="auto">
              {profile?.name || username || 'X'}
            </div>
            <div className="x-handle">@{username}</div>
          </div>
          {profile?.description && (
            <p className="x-bio" dir="auto">
              {profile.description}
            </p>
          )}
          <div className="x-profile-meta">
            {profile?.website && /^https?:\/\//.test(profile.website) && (
              <span className="x-meta-item">
                <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                  <path d={LINK_ICON} />
                </svg>
                <a href={profile.website} target="_blank" rel="noopener noreferrer">
                  {profile.websiteLabel || profile.website}
                </a>
              </span>
            )}
            {profile?.joined && (
              <span className="x-meta-item">
                <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                  <path d={CALENDAR_ICON} />
                </svg>
                <span>Joined {profile.joined}</span>
              </span>
            )}
          </div>
          <div className="x-profile-counts">
            {profile?.following != null && (
              <a href={`${href}/following`} target="_blank" rel="noopener noreferrer">
                <strong>{profile.following}</strong> <span>Following</span>
              </a>
            )}
            {profile?.followers != null && (
              <a href={`${href}/verified_followers`} target="_blank" rel="noopener noreferrer">
                <strong>{profile.followers}</strong> <span>Followers</span>
              </a>
            )}
            {profile?.posts != null && (
              <a href={href} target="_blank" rel="noopener noreferrer">
                <strong>{profile.posts}</strong> <span>Posts</span>
              </a>
            )}
          </div>
          {!profile && (loading || error) && (
            <p className="x-status" role="status">
              {loading ? 'Loading profile…' : 'Profile unavailable. You can still open X.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
