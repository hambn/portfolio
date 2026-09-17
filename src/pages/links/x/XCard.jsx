import './XCard.css';
import React, { useState } from 'react';
import { apiUrl } from '../../../lib/api.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { xUsername } from '../../../../shared/x.js';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const X_ICON =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z';
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
        {banner && banner !== failedBanner && (
          <img className="x-banner" src={banner} alt="" onError={() => setFailedBanner(banner)} />
        )}
        <div className="x-style-7" aria-busy={loading && !profile}>
          <div style={{ borderColor: 'var(--x-border)' }} className="x-style-8">
            {avatar && avatar !== failedAvatar ? (
              <img
                className="x-avatar"
                src={avatar}
                alt=""
                onError={() => setFailedAvatar(avatar)}
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="var(--x-text)"
                width={26}
                height={26}
                className="x-style-9"
              >
                <path d={X_ICON} />
              </svg>
            )}
          </div>
          <div className="x-style-10">
            <div className="x-style-11">
              <span style={{ color: 'var(--x-text)' }} dir="auto">
                {profile?.name || username || 'X'}
              </span>
            </div>
            <div style={{ color: 'var(--x-muted)' }} className="x-style-12">
              @{username}
            </div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer" className="x-style-13">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width={12}
              height={12}
              className="x-style-14"
            >
              <path d={X_ICON} />
            </svg>
            <span>Follow</span>
          </a>
        </div>
        {profile?.description && (
          <p className="x-bio" dir="auto">
            {profile.description}
          </p>
        )}
        <div className="x-profile-meta">
          {profile?.website && /^https?:\/\//.test(profile.website) && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.websiteLabel || profile.website}
            </a>
          )}
          {profile?.joined && <span>Joined {profile.joined}</span>}
        </div>
        <div className="x-profile-counts">
          {profile?.following != null && (
            <a href={`${href}/following`} target="_blank" rel="noopener noreferrer">
              <strong>{profile.following}</strong> Following
            </a>
          )}
          {profile?.followers != null && (
            <a href={`${href}/verified_followers`} target="_blank" rel="noopener noreferrer">
              <strong>{profile.followers}</strong> Followers
            </a>
          )}
          {profile?.posts != null && (
            <a href={href} target="_blank" rel="noopener noreferrer">
              <strong>{profile.posts}</strong> Posts
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
  );
}
