import { mediaUrl } from '../../../lib/api.js';
import './SteamCard.css';
import React, { useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { useCardFeed } from '../LinksFeed.jsx';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';

// Steam serves one fixed size per artwork slug, so these are the real pixel
// dimensions of every header.jpg / library_hero.jpg. CSS still decides how big
// they're drawn — the attributes only hand the browser an aspect ratio up
// front, so lazily-loaded art doesn't reflow the card when it arrives.
const HEADER_W = 460;
const HEADER_H = 215;
const HERO_W = 1920;
const HERO_H = 620;

// ── Palette (always dark — Steam brand) ───────────────────────────────────────
const ST = {
  bg: 'linear-gradient(145deg,#233448 0%,#1b2838 55%,#171d25 100%)',
  bgHead: '#171d25',
  border: '#344659',
  div: 'rgba(61,90,115,0.45)',
  blue: '#66c0f4',
  white: '#e5e9ed',
  muted: '#8f98a0',
  faint: '#8b9bad',
  surf: 'rgba(102,192,244,0.07)',
  ingame: '#90ba3c',
  online: '#57cbde',
};

// ── Steam icon ────────────────────────────────────────────────────────────────
const ST_ICON_PATH =
  'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z';
function StIcon({ size, color }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color || ST.blue}
      width={size || 16}
      height={size || 16}
      className="st-style-1"
    >
      <path d={ST_ICON_PATH} />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stFmtHrs(h) {
  if (h == null) return null;
  const n = parseFloat(h);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k hrs`;
  if (n < 1) return `${Math.round(n * 60)} min`;
  return `${n % 1 === 0 ? n : n.toFixed(1)} hrs`;
}

// ── Game Row ──────────────────────────────────────────────────────────────────
function StGameRow({ game, showRecent }) {
  if (!game) return null;
  const href = `https://store.steampowered.com/app/${game.appid}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="st-game-row st-style-2">
      {/* library_hero as subtle background */}
      {game.images?.hero && (
        <img
          src={mediaUrl(game.images.hero)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="st-style-3"
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
          className="st-style-5"
        />
      ) : (
        <div
          style={{
            background: ST.surf,
          }}
          className="st-style-6"
        >
          <StIcon size={16} />
        </div>
      )}
      <div className="st-style-7">
        <div
          style={{
            color: ST.white,
          }}
          className="st-style-8"
        >
          {game.name}
        </div>
        <div className="st-style-9">
          {showRecent && game.playtime_2weeks_hours != null && (
            <span
              style={{
                color: ST.blue,
              }}
              className="st-style-10"
            >
              {stFmtHrs(game.playtime_2weeks_hours)} past 2 weeks
            </span>
          )}
          {(game.playtime_total_hours != null || game.playtime_hours != null) && (
            <span
              style={{
                color: ST.muted,
              }}
              className="st-style-11"
            >
              {stFmtHrs(game.playtime_total_hours ?? game.playtime_hours)} on record
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function StSectionLabel({ children, detail }) {
  return (
    <div
      style={{
        color: ST.white,
      }}
      className="st-style-12"
    >
      <span>{children}</span>
      {detail && <span className="st-section-detail">{detail}</span>}
    </div>
  );
}

// ── Recent Activity section ───────────────────────────────────────────────────
function StRecentSection({ items }) {
  return (
    <div className="st-style-14">
      {items.map((game, i) => (
        <StGameRow key={game.appid || i} game={game} showRecent={true} />
      ))}
    </div>
  );
}

// ── Favorite Game section ─────────────────────────────────────────────────────
function StFavoriteSection({ game }) {
  if (!game) return null;
  const href = `https://store.steampowered.com/app/${game.appid}`;
  return (
    <div className="st-favorite">
      {(game.images?.hero || game.images?.header) && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="st-hero-link st-style-15"
        >
          <img
            className="st-hero-img st-style-16"
            src={mediaUrl(game.images.hero || game.images.header)}
            alt={game.name}
            width={game.images.hero ? HERO_W : HEADER_W}
            height={game.images.hero ? HERO_H : HEADER_H}
            loading="lazy"
            decoding="async"
          />
        </a>
      )}
      <div className="st-style-17">
        {game.images?.header && (
          // A thumbnail shortcut to the same page as the game-name link next to
          // it. Hidden from assistive tech (and from tab order, so focus can't
          // land on a nameless link) rather than given a duplicate name.
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="st-style-18"
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
              className="st-style-19"
            />
          </a>
        )}
        <div className="st-style-20">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: ST.white,
            }}
            className="st-style-21"
          >
            {game.name}
          </a>
        </div>
        {(game.playtime_hours != null || game.playtime_total_hours != null) && (
          <div
            style={{
              color: ST.blue,
            }}
            className="st-style-22"
          >
            <span className="st-hours-value">
              {Number(game.playtime_hours ?? game.playtime_total_hours).toLocaleString('en-US', {
                maximumFractionDigits: 1,
              })}
            </span>
            <span className="st-hours-label">Hours played</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main SteamCard ────────────────────────────────────────────────────────────
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
    (d) => setData(d),
    useCardFeed('steam'),
  );
  const isInGame = !!data?.currentGame;
  const statusStr = (data?.status || '').toLowerCase();
  const isOnline = statusStr === 'online' || isInGame;
  const dotColor = isInGame ? ST.ingame : isOnline ? ST.online : ST.faint;
  const statusLabel = isInGame ? `In-Game` : data?.status || 'offline';

  // ── Simple card ───────────────────────────────────────────────────────────
  if (!apiEndpoint) {
    return (
      <a
        href={url || `https://steamcommunity.com/id/${handle}/`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: ST.bg,
          border: `1px solid ${ST.border}`,
        }}
        className="st-style-23"
      >
        <StIcon size={20} />
        <div>
          <div
            style={{
              color: ST.blue,
            }}
            className="st-style-24"
          >
            steam
          </div>
          <div
            style={{
              color: ST.faint,
            }}
            className="st-style-25"
          >
            @{handle}
          </div>
        </div>
        <span
          style={{
            color: ST.faint,
          }}
          className="st-style-26"
        >
          open →
        </span>
      </a>
    );
  }
  return (
    <div
      style={{
        background: ST.bg,
        border: `1px solid ${ST.border}`,
      }}
      className="st-style-27 link-card"
    >
      {/* ── Brand header — always visible ── */}
      <div
        style={{
          background: ST.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${ST.border}`,
        }}
        className="st-style-28 link-card-header"
      >
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="st-style-29 link-card-brand"
        >
          <StIcon size={24} color="#dcdedf" />
          <span
            style={{
              color: '#dcdedf',
            }}
            className="st-style-30 link-card-title"
          >
            Steam
          </span>
        </a>

        {loading && !data && (
          <span
            style={{
              color: ST.faint,
            }}
            className="st-style-31"
          >
            loading…
          </span>
        )}
        {error && <span className="st-style-32">error</span>}

        <div className="st-style-33 link-card-spacer" />

        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn st-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent={ST.blue}
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy Steam profile link"
            href={profileUrl}
            openLabel="open in steam"
            openTitle="Open in Steam"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        {/* ── Profile row — status lives here, next to name ── */}
        {data && (
          <div
            style={{
              borderBottom: `1px solid ${ST.div}`,
            }}
            className="st-style-34"
          >
            {data.avatar?.large ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="st-style-35"
              >
                <img
                  src={mediaUrl(data.avatar.large)}
                  alt={data.displayName}
                  width={88}
                  height={88}
                  loading="lazy"
                  decoding="async"
                  style={{
                    border: `2px solid ${dotColor}`,
                  }}
                  className="st-style-36"
                />
              </a>
            ) : (
              <div
                style={{
                  border: `2px solid ${ST.faint}`,
                }}
                className="st-style-37"
              >
                <StIcon size={24} />
              </div>
            )}

            <div className="st-style-38">
              {/* Name + status on the same line */}
              <div className="st-style-39">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: ST.white,
                  }}
                  className="st-style-40"
                >
                  {data.displayName}
                </a>
                {/* Status badge next to name */}
                <span
                  style={{
                    color: dotColor,
                  }}
                  className="st-style-41"
                >
                  <span
                    style={{
                      background: dotColor,
                      boxShadow: isOnline ? `0 0 6px ${dotColor}99` : 'none',
                    }}
                    className="st-style-42"
                  ></span>
                  {statusLabel}
                </span>
              </div>

              {/* Meta row: level, game count, member since */}
              <div className="st-style-43">
                {data.totalGames != null && (
                  <span
                    style={{
                      color: ST.muted,
                    }}
                    className="st-style-45"
                  >
                    <span
                      style={{
                        color: ST.white,
                      }}
                      className="st-style-46"
                    >
                      {data.totalGames}
                    </span>{' '}
                    games
                  </span>
                )}
                {data.memberSince && (
                  <span
                    style={{
                      color: ST.faint,
                    }}
                    className="st-style-47"
                  >
                    Member since {new Date(data.memberSince).getFullYear()}
                  </span>
                )}
              </div>
            </div>

            <div className="st-profile-side">
              {data.level != null && (
                <span className="st-level">
                  Level <span className="st-style-44">{data.level}</span>
                </span>
              )}
              {/* The label has to contain the visible "View profile" text —
                  a voice-control user says what they can see. */}
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View profile on Steam"
                className="st-open-btn st-style-48"
              >
                <StIcon size={14} color="#fff" />
                <span className="st-open-label">View profile</span>
              </a>
            </div>
          </div>
        )}

        {/* Currently in-game banner */}
        {data?.currentGame &&
          (() => {
            const cg =
              typeof data.currentGame === 'string'
                ? {
                    name: data.currentGame,
                  }
                : data.currentGame;
            const cgHref = cg.appid ? `https://store.steampowered.com/app/${cg.appid}` : null;
            return (
              <div
                style={{
                  borderBottom: `1px solid ${ST.div}`,
                }}
                className="st-style-49"
              >
                {/* library_hero full-bleed background */}
                {cg.images?.hero && (
                  <img
                    src={mediaUrl(cg.images.hero)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="st-style-50"
                  />
                )}
                {/* dark gradient overlay so text stays readable */}
                <div className="st-style-51"></div>
                {/* content */}
                <div className="st-style-52">
                  <span
                    style={{
                      background: ST.ingame,
                      boxShadow: `0 0 7px ${ST.ingame}99`,
                    }}
                    className="st-style-53"
                  ></span>
                  {/* header capsule */}
                  {cg.images?.header && cgHref && (
                    <a
                      href={cgHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-style-54"
                    >
                      <img
                        src={mediaUrl(cg.images.header)}
                        alt={cg.name}
                        width={HEADER_W}
                        height={HEADER_H}
                        loading="lazy"
                        decoding="async"
                        className="st-style-55"
                      />
                    </a>
                  )}
                  <div>
                    <div className="st-style-56">now playing</div>
                    <div
                      style={{
                        color: ST.ingame,
                      }}
                      className="st-style-57"
                    >
                      {cg.name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── Sections stacked — no tabs ── */}
        {data && (
          <div className="st-style-58">
            {data.recentActivity?.length > 0 && (
              <div className="st-showcase">
                <StSectionLabel
                  detail={
                    data.recentActivity.some((game) => game.playtime_2weeks_hours != null)
                      ? `${stFmtHrs(data.recentActivity.reduce((total, game) => total + (Number(game.playtime_2weeks_hours) || 0), 0))} past 2 weeks`
                      : null
                  }
                >
                  Recent activity
                </StSectionLabel>
                <StRecentSection items={data.recentActivity} />
              </div>
            )}

            {data.favoriteGame && (
              <div className="st-showcase">
                <StSectionLabel>Favorite game</StSectionLabel>
                <StFavoriteSection game={data.favoriteGame} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
