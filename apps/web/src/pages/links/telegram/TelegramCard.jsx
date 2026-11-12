import { apiUrl } from '../../../lib/api.js';
import '../link-fonts.css';
import './TelegramCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { telegramUsername } from '@portfolio/shared/telegram';
import { BRAND_ICON } from '../brandIcons.js';

const TG_ICON = BRAND_ICON.tg;

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
            accent="var(--tg-accent)"
            copied={copied}
            onCopy={copyLink}
            copyTitle="Copy Telegram profile link"
            href={href}
            openTitle="Open in Telegram"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        data-card="tg"
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
