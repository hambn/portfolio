import { mediaUrl } from '../../../lib/api.js';
import { EXTERNAL } from '../../../lib/external.js';
import './SteamCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { BRAND_ICON } from '../brandIcons.js';

// Steam serves one fixed size per artwork slug, so these are the real pixel
// dimensions of every header.jpg / library_hero.jpg. CSS still decides how big
// they're drawn — the attributes only hand the browser an aspect ratio up
// front, so lazily-loaded art doesn't reflow the card when it arrives.
const HEADER_W = 460;
const HEADER_H = 215;
const HERO_W = 1920;
const HERO_H = 620;

const storeUrl = (appid) => `https://store.steampowered.com/app/${appid}`;

// Colours come from SteamCard.css: blue by default, the surrounding text
// colour inside the header and the profile button.
function StIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="st-icon">
      <path d={BRAND_ICON.st} />
    </svg>
  );
}

function formatHours(hours) {
  if (hours == null) return null;
  const n = parseFloat(hours);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k hrs`;
  if (n < 1) return `${Math.round(n * 60)} min`;
  return `${n % 1 === 0 ? n : n.toFixed(1)} hrs`;
}

// "12.5 hrs past 2 weeks" across every recent game, or null when Steam sent no
// two-week figures at all.
function recentTotal(games) {
  if (!games.some((game) => game.playtime_2weeks_hours != null)) return null;
  const hours = games.reduce((sum, game) => sum + (Number(game.playtime_2weeks_hours) || 0), 0);
  return `${formatHours(hours)} past 2 weeks`;
}

function StGameRow({ game }) {
  const total = game.playtime_total_hours ?? game.playtime_hours;
  return (
    <a href={storeUrl(game.appid)} {...EXTERNAL} className="st-game-row">
      {game.images?.hero && (
        <img
          src={mediaUrl(game.images.hero)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="st-game-bg"
        />
      )}
      {game.images?.header ? (
        <img
          src={mediaUrl(game.images.header)}
          alt={game.name}
          width={HEADER_W}
          height={HEADER_H}
          loading="lazy"
          decoding="async"
          className="st-game-art"
        />
      ) : (
        <div className="st-game-art-empty">
          <StIcon />
        </div>
      )}
      <div className="st-game-info">
        <div className="st-game-name">{game.name}</div>
        <div className="st-game-times">
          {game.playtime_2weeks_hours != null && (
            <span className="st-game-recent">
              {formatHours(game.playtime_2weeks_hours)} past 2 weeks
            </span>
          )}
          {total != null && <span className="st-game-total">{formatHours(total)} on record</span>}
        </div>
      </div>
    </a>
  );
}

function StSection({ title, detail, children }) {
  return (
    <div className="st-showcase">
      <div className="st-section-label">
        <span>{title}</span>
        {detail && <span className="st-section-detail">{detail}</span>}
      </div>
      {children}
    </div>
  );
}

function StFavorite({ game }) {
  const href = storeUrl(game.appid);
  const hours = game.playtime_hours ?? game.playtime_total_hours;
  return (
    <div className="st-favorite">
      {(game.images?.hero || game.images?.header) && (
        <a href={href} {...EXTERNAL} className="st-hero-link">
          <img
            className="st-hero-img"
            src={mediaUrl(game.images.hero || game.images.header)}
            alt={game.name}
            width={game.images.hero ? HERO_W : HEADER_W}
            height={game.images.hero ? HERO_H : HEADER_H}
            loading="lazy"
            decoding="async"
          />
        </a>
      )}
      <div className="st-favorite-body">
        {game.images?.header && (
          // A thumbnail shortcut to the same page as the game-name link next to
          // it. Hidden from assistive tech (and from tab order, so focus can't
          // land on a nameless link) rather than given a duplicate name.
          <a
            href={href}
            {...EXTERNAL}
            className="st-favorite-thumb"
            aria-hidden="true"
            tabIndex={-1}
          >
            <img
              src={mediaUrl(game.images.header)}
              alt=""
              width={HEADER_W}
              height={HEADER_H}
              loading="lazy"
              decoding="async"
              className="st-favorite-thumb-img"
            />
          </a>
        )}
        <div className="st-favorite-title">
          <a href={href} {...EXTERNAL} className="st-favorite-name">
            {game.name}
          </a>
        </div>
        {hours != null && (
          <div className="st-favorite-hours">
            <span className="st-hours-value">
              {Number(hours).toLocaleString('en-US', { maximumFractionDigits: 1 })}
            </span>
            <span className="st-hours-label">Hours played</span>
          </div>
        )}
      </div>
    </div>
  );
}

// The banner for the game being played right now. Steam sends either the full
// game or, when it knows nothing more, just its name.
function StNowPlaying({ game }) {
  const current = typeof game === 'string' ? { name: game } : game;
  return (
    <div className="st-now">
      {current.images?.hero && (
        <img
          src={mediaUrl(current.images.hero)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="st-now-bg"
        />
      )}
      <div className="st-now-shade" />
      <div className="st-now-body">
        <span className="st-now-dot" />
        {current.images?.header && current.appid && (
          <a href={storeUrl(current.appid)} {...EXTERNAL} className="st-now-art-link">
            <img
              src={mediaUrl(current.images.header)}
              alt={current.name}
              width={HEADER_W}
              height={HEADER_H}
              loading="lazy"
              decoding="async"
              className="st-now-art"
            />
          </a>
        )}
        <div>
          <div className="st-now-label">now playing</div>
          <div className="st-now-name">{current.name}</div>
        </div>
      </div>
    </div>
  );
}

// Avatar, name and presence, with the level and the profile button beside them.
function StProfile({ data, profileUrl }) {
  const inGame = Boolean(data.currentGame);
  const online = inGame || (data.status || '').toLowerCase() === 'online';
  const status = inGame ? 'ingame' : online ? 'online' : 'offline';
  return (
    <div className="st-profile" data-status={status}>
      {data.avatar?.large ? (
        <a href={profileUrl} {...EXTERNAL} className="st-avatar-link">
          <img
            src={mediaUrl(data.avatar.large)}
            alt={data.displayName}
            width={88}
            height={88}
            loading="lazy"
            decoding="async"
            className="st-avatar"
          />
        </a>
      ) : (
        <div className="st-avatar-empty">
          <StIcon size={24} />
        </div>
      )}

      <div className="st-profile-main">
        <div className="st-name-row">
          <a href={profileUrl} {...EXTERNAL} className="st-name">
            {data.displayName}
          </a>
          <span className="st-presence">
            <span className="st-presence-dot" />
            {inGame ? 'In-Game' : data.status || 'offline'}
          </span>
        </div>
        <div className="st-meta">
          {data.totalGames != null && (
            <span className="st-games">
              <span className="st-games-count">{data.totalGames}</span> games
            </span>
          )}
          {data.memberSince && (
            <span className="st-member-since">
              Member since {new Date(data.memberSince).getFullYear()}
            </span>
          )}
        </div>
      </div>

      <div className="st-profile-side">
        {data.level != null && (
          <span className="st-level">
            Level <span className="st-level-badge">{data.level}</span>
          </span>
        )}
        {/* The label has to contain the visible "View profile" text —
            a voice-control user says what they can see. */}
        <a
          href={profileUrl}
          {...EXTERNAL}
          aria-label="View profile on Steam"
          className="st-open-btn"
        >
          <StIcon size={14} />
          <span className="st-open-label">View profile</span>
        </a>
      </div>
    </div>
  );
}

// The card when no API endpoint is configured: one link to the profile.
function StSimpleCard({ href, handle }) {
  return (
    <a href={href} {...EXTERNAL} className="st-simple">
      <StIcon size={20} />
      <div>
        <div className="st-simple-name">steam</div>
        <div className="st-simple-handle">@{handle}</div>
      </div>
      <span className="st-simple-open">open →</span>
    </a>
  );
}

export const SteamCard = React.memo(function SteamCard({ handle, url, apiEndpoint }) {
  const [data, setData] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('st_card_collapsed');
  const profileUrl =
    data?.profileUrl ||
    url ||
    (handle ? `https://steamcommunity.com/id/${handle}/` : 'https://steamcommunity.com');
  const [copied, copyLink] = useCopy(profileUrl);
  const { loading, error } = usePolledJSON(
    collapsed ? null : apiEndpoint,
    60000,
    setData,
    useCardFeed('steam'),
  );

  if (!apiEndpoint) return <StSimpleCard href={profileUrl} handle={handle} />;

  return (
    <div className="st-card link-card">
      <div className="st-header link-card-header">
        <a href={profileUrl} {...EXTERNAL} className="st-brand link-card-brand">
          <StIcon size={24} />
          <span className="st-wordmark link-card-title">Steam</span>
        </a>

        {loading && !data && <span className="st-loading">loading…</span>}

        <div className="link-card-spacer" />

        <div className="link-card-actions">
          <HeaderButtons
            accent="var(--st-blue)"
            copied={copied}
            onCopy={copyLink}
            copyTitle="Copy Steam profile link"
            href={profileUrl}
            openTitle="Open in Steam"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>

      <div
        data-card="st"
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        {!data && (loading || error) && (
          <p className="st-status" role="status">
            {loading ? 'Loading profile…' : 'Profile unavailable. You can still open Steam.'}
          </p>
        )}
        {data && <StProfile data={data} profileUrl={profileUrl} />}
        {data?.currentGame && <StNowPlaying game={data.currentGame} />}
        {data && (
          <div className="st-sections">
            {data.recentActivity?.length > 0 && (
              <StSection title="Recent activity" detail={recentTotal(data.recentActivity)}>
                <div className="st-recent">
                  {data.recentActivity.map((game, i) => (
                    <StGameRow key={game.appid || i} game={game} />
                  ))}
                </div>
              </StSection>
            )}
            {data.favoriteGame && (
              <StSection title="Favorite game">
                <StFavorite game={data.favoriteGame} />
              </StSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
