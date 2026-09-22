import { apiUrl } from '../../../lib/api.js';
import '../link-fonts.css';
import './TelegramCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { telegramUsername } from '../../../../shared/telegram.js';

const TG_ICON =
  'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z';

export const TelegramCard = React.memo(function TelegramCard({
  username,
  handle,
  url,
  apiEndpoint,
}) {
  const configuredUsername = telegramUsername(url || username || handle);
  return (
    <TelegramProfile
      key={configuredUsername}
      username={configuredUsername}
      apiEndpoint={apiEndpoint}
    />
  );
});

function TelegramProfile({ username, apiEndpoint }) {
  const [profile, setProfile] = useState(null);
  const [failedPhoto, setFailedPhoto] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('tg_card_collapsed');
  const href = username ? `https://t.me/${username}` : 'https://telegram.org';
  const [copied, copyLink] = useCopy(href);
  const endpoint = new URL(
    apiEndpoint || apiUrl('/telegram'),
    globalThis.location?.origin || 'https://api.portfolio.hgh.dev',
  );
  endpoint.searchParams.set('username', username || '');
  const { loading, error } = usePolledJSON(
    username && !collapsed ? endpoint.href : null,
    3600000,
    (data) => {
      if (data?.username === username) setProfile(data);
    },
    useCardFeed('telegram'),
  );
  const name = profile?.name || (username ? `@${username}` : 'Telegram');
  const photo = profile?.photo ? new URL(profile.photo, endpoint).href : null;

  return (
    <section className="tg-card link-card" aria-label="Telegram profile">
      <div className="tg-header link-card-header">
        <a className="link-card-brand" href={href} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={TG_ICON} />
          </svg>
          <span className="link-card-title">Telegram</span>
        </a>
        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn tg-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent="var(--tg-accent)"
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy Telegram profile link"
            href={href}
            openLabel="open in telegram"
            openTitle="Open in Telegram"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="tg-wallpaper">
          <div className="tg-profile" aria-busy={loading && !profile}>
            {photo && photo !== failedPhoto ? (
              <img
                className="tg-avatar"
                src={photo}
                alt=""
                width="108"
                height="108"
                loading="lazy"
                decoding="async"
                onError={() => setFailedPhoto(photo)}
              />
            ) : (
              <div className="tg-avatar tg-avatar-fallback" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="56" height="56" fill="currentColor">
                  <path d={TG_ICON} />
                </svg>
              </div>
            )}
            <h2 className="tg-name" dir="auto">
              {name}
            </h2>
            {username && <div className="tg-username">@{username}</div>}
            {profile?.description && (
              <p className="tg-description" dir="auto">
                {profile.description}
              </p>
            )}
            <a className="tg-message" href={href} target="_blank" rel="noopener noreferrer">
              Send Message
            </a>
            <p className="tg-contact">
              If you have <strong>Telegram</strong>, you can contact
              <br />
              <strong>{name.split(' ')[0]}</strong> right away.
            </p>
            {!profile && (loading || error) && (
              <p className="tg-status" role="status">
                {loading ? 'Loading profile…' : 'Profile unavailable. You can still open Telegram.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
