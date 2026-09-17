import './LinkedInCard.css';
import React, { useState } from 'react';
import { apiUrl } from '../../../lib/api.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { linkedinUsername } from '../../../../shared/linkedin.js';
const LI_ICON =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 23.227 23.2 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';

export function LinkedInCard({ handle, username, url, apiEndpoint }) {
  const configuredUsername = linkedinUsername(username || handle || url);
  return (
    <LinkedInProfile
      key={configuredUsername}
      username={configuredUsername}
      apiEndpoint={apiEndpoint}
    />
  );
}

function LinkedInProfile({ username, apiEndpoint }) {
  const [profile, setProfile] = useState(null);
  const [failedAvatar, setFailedAvatar] = useState(null);
  const [failedBanner, setFailedBanner] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('li_card_collapsed');
  const href = username ? `https://www.linkedin.com/in/${username}/` : 'https://www.linkedin.com';
  const [copied, copyLink] = useCopy(href);
  const endpoint = new URL(
    apiEndpoint || apiUrl('/linkedin'),
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
  const name = profile?.name || username || 'LinkedIn';

  return (
    <section className="li-card link-card" aria-label="LinkedIn profile">
      <div className="li-header link-card-header">
        <a className="link-card-brand" href={href} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
            <path d={LI_ICON} />
          </svg>
          <span className="link-card-title">LinkedIn</span>
        </a>
        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn li-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent="#0a66c2"
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy LinkedIn profile link"
            href={href}
            openLabel="open on linkedin"
            openTitle="Open on LinkedIn"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="li-banner">
          {banner && banner !== failedBanner && (
            <img src={banner} alt="" onError={() => setFailedBanner(banner)} />
          )}
        </div>
        <div className="li-identity" aria-busy={loading && !profile}>
          {avatar && avatar !== failedAvatar ? (
            <img
              className="li-avatar"
              src={avatar}
              alt=""
              width="88"
              height="88"
              onError={() => setFailedAvatar(avatar)}
            />
          ) : (
            <div className="li-avatar li-avatar-fallback" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
                <path d={LI_ICON} />
              </svg>
            </div>
          )}
          <div className="li-intro">
            <div>
              <h2 className="li-name" dir="auto">
                {name}
              </h2>
              {profile?.headline && (
                <p className="li-headline" dir="auto">
                  {profile.headline}
                </p>
              )}
              {profile?.location && (
                <p className="li-location" dir="auto">
                  {profile.location}
                </p>
              )}
              <div className="li-counts">
                {profile?.followers != null && <span>{profile.followers} followers</span>}
                {profile?.connections != null && <span>{profile.connections} connections</span>}
              </div>
            </div>
            {profile?.organizations?.length > 0 && (
              <ul className="li-organizations">
                {profile.organizations.map((organization) => (
                  <li key={organization} dir="auto">
                    {organization}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <a className="li-profile-button" href={href} target="_blank" rel="noopener noreferrer">
            View profile
          </a>
          {!profile && (loading || error) && (
            <p className="li-status" role="status">
              {loading ? 'Loading profile…' : 'Profile unavailable. You can still open LinkedIn.'}
            </p>
          )}
        </div>
        {profile?.about && (
          <section className="li-section">
            <h3>About</h3>
            <p className="li-about" dir="auto">
              {profile.about}
            </p>
          </section>
        )}
        {profile?.languages?.length > 0 && (
          <section className="li-section">
            <h3>Languages</h3>
            <dl className="li-languages">
              {profile.languages.map((language) => (
                <div key={language.name}>
                  <dt dir="auto">{language.name}</dt>
                  {language.proficiency && <dd dir="auto">{language.proficiency}</dd>}
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </section>
  );
}
