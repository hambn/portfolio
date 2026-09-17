import { mediaUrl } from '../../../lib/api.js';
import '@fontsource-variable/dm-sans/wght.css';
import './DiscordCard.css';
// Uses the API profile endpoint and its live presence relay.
import React, { useEffect, useState } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { usePolledJSON } from '../../../hooks/usePolledJSON.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';

const DC = {
  bg: 'var(--dc-bg)',
  bgHead: 'var(--dc-bg-head)',
  border: 'var(--dc-border)',
  divider: 'var(--dc-divider)',
  blurple: 'var(--dc-blurple)',
  blurpleLt: 'var(--dc-blurple-light)',
  text: 'var(--dc-text)',
  muted: 'var(--dc-muted)',
  faint: 'var(--dc-subtle)',
  STATUS_COLOR: {
    online: '#23a55a',
    idle: '#f0b232',
    dnd: '#f23f43',
    offline: '#80848e',
  },
  STATUS_LABEL: {
    online: 'online',
    idle: 'idle',
    dnd: 'do not disturb',
    offline: 'offline',
  },
};

const DC_ICON =
  'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.113 18.1.138 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.027c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.948-2.157 2.157-2.157 1.211 0 2.157.964 2.157 2.157 0 1.191-.946 2.156-2.157 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.948-2.157 2.157-2.157 1.211 0 2.157.964 2.157 2.157 0 1.191-.946 2.156-2.157 2.156z';

function DcIcon({ size = 16, color }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color || DC.blurple}
      width={size}
      height={size}
      aria-hidden="true"
      className="dc-icon"
    >
      <path d={DC_ICON} />
    </svg>
  );
}

function ActivityIcon({ size = 13 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.5 7.5h9a3 3 0 0 1 2.9 2.25l1 3.75a3 3 0 0 1-5.8 1.5l-.4-1.5H9.8l-.4 1.5a3 3 0 0 1-5.8-1.5l1-3.75A3 3 0 0 1 7.5 7.5Z" />
      <path d="M8 10.5v3M6.5 12h3M16 11.5h.01M18 13h.01" />
    </svg>
  );
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function activityTiming(activity, now) {
  const start = Number(activity?.timestamps?.start);
  const end = Number(activity?.timestamps?.end);
  if (!Number.isFinite(start) || start <= 0) return null;

  const elapsed = Math.max(0, now - start);
  const total = Number.isFinite(end) && end > start ? end - start : null;
  return {
    elapsed: formatDuration(total ? Math.min(elapsed, total) : elapsed),
    total: total ? formatDuration(total) : null,
    progress: total ? Math.min(1, Math.max(0, elapsed / total)) : null,
  };
}

function ActivityArtwork({ src, alt, isGame }) {
  const [failedSrc, setFailedSrc] = useState(null);
  return (
    <div className={`dc-activity-art${!src || failedSrc === src ? ' is-broken' : ''}`}>
      {src && <img src={src} alt={alt || ''} onError={() => setFailedSrc(src)} />}
      <span className="dc-activity-art-fallback">
        {isGame ? <ActivityIcon size={28} /> : <DcIcon size={27} color="currentColor" />}
      </span>
    </div>
  );
}

export function DiscordCard({ userId, lanyardData, apiEndpoint }) {
  const [apiData, setApiData] = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('dc_card_collapsed');

  // Lanyard is the live source when its WebSocket is connected. Keep the
  // polled API as a fallback for the first paint and reconnect gaps. The two
  // shapes differ, so map them to one display model below.
  const raw = lanyardData || apiData;
  const flat = !!raw?.username && !raw?.discord_user;
  const status = raw ? (flat ? raw.status : raw.discord_status) || 'offline' : 'unknown';
  const user = flat ? raw : raw?.discord_user;
  const displayName =
    (flat ? raw.displayName || raw.username : user?.global_name || user?.username) || null;
  const handle = (flat ? raw.username : user?.username) || null;
  const avatarSource = flat
    ? raw.avatar || null
    : user?.avatar && user?.id
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : null;
  const avatarUrl = mediaUrl(avatarSource);
  const activities = raw?.activities || [];
  const customStatus = activities.find((activity) => activity.type === 4);
  const liveActivities = activities.filter((activity) => activity.type !== 4);
  const hasTimedActivity = liveActivities.some((activity) => activity.timestamps?.start);
  // Start at a deterministic value for SSR hydration, then begin the clock
  // once a timed activity is present in the browser.
  const [now, setNow] = useState(0);
  const profileUrl = `https://discord.com/users/${userId}`;
  const dotColor = DC.STATUS_COLOR[status] || DC.STATUS_COLOR.offline;
  const [copied, copyLink] = useCopy(profileUrl);

  useEffect(() => {
    if (!hasTimedActivity) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hasTimedActivity]);

  const { loading } = usePolledJSON(collapsed ? null : apiEndpoint, 30000, (data) => {
    if (data?.username) setApiData(data);
  });

  const getActivityImgSrc = (activity) => {
    if (!activity?.assets?.large_image) return null;
    const image = activity.assets.large_image;
    if (image.startsWith('spotify:')) return mediaUrl(`https://i.scdn.co/image/${image.slice(8)}`);
    if (image.startsWith('mp:')) return mediaUrl(`https://media.discordapp.net/${image.slice(3)}`);
    return activity.application_id
      ? mediaUrl(`https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}.png`)
      : null;
  };

  const activityLabel = {
    0: 'Playing',
    1: 'Streaming',
    2: 'Listening to',
    3: 'Watching',
    5: 'Competing in',
  };

  return (
    <div
      className="dc-card link-card"
      style={{
        background: DC.bg,
        border: `1px solid ${DC.border}`,
      }}
    >
      <div
        className="dc-header link-card-header"
        style={{
          background: DC.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${DC.border}`,
        }}
      >
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dc-brand link-card-brand"
        >
          <DcIcon size={24} />
          <span className="dc-title link-card-title" style={{ color: DC.blurpleLt }}>
            Discord
          </span>
        </a>

        {loading && !raw && <span className="dc-loading">updating…</span>}

        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn dc-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent={DC.blurpleLt}
            copied={copied}
            onCopy={copyLink}
            copyLabel="copy profile link"
            copyTitle="Copy Discord profile link"
            href={profileUrl}
            openLabel="open in discord"
            openTitle="Open in Discord"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>

      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="dc-profile">
          <div className="dc-avatar-wrap">
            {avatarUrl ? (
              <img className="dc-avatar" src={avatarUrl} alt={displayName || handle || 'Discord'} />
            ) : (
              <div className="dc-avatar dc-avatar-fallback">
                <DcIcon size={27} color="white" />
              </div>
            )}
            <span
              className={`dc-status dc-status-${status}`}
              role="img"
              aria-label={DC.STATUS_LABEL[status] || 'Presence unavailable'}
              style={{
                background: dotColor,
              }}
            />
          </div>

          <div className="dc-profile-copy">
            <span className="dc-profile-label">
              {DC.STATUS_LABEL[status] || (loading ? 'Connecting…' : 'Presence unavailable')}
            </span>
            {displayName ? (
              <div className="dc-display-name" style={{ color: DC.text }}>
                {displayName}
              </div>
            ) : (
              <div className="dc-display-name dc-empty" style={{ color: DC.faint }}>
                —
              </div>
            )}
            {handle && <div className="dc-handle">@{handle}</div>}
            {customStatus?.state && (
              <div className="dc-custom-status">
                {customStatus.emoji?.name && (
                  <span className="dc-custom-emoji">{customStatus.emoji.name}</span>
                )}
                {customStatus.state}
              </div>
            )}
          </div>

          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="dc-open-btn">
            <DcIcon size={13} color="currentColor" />
            <span>View profile</span>
          </a>
        </div>

        {liveActivities.length > 0 && (
          <section className="dc-activities" aria-label="Current activity">
            <div className="dc-activities-heading">Current activity</div>
            {liveActivities.map((activity, index) => {
              const timing = activityTiming(activity, now);
              const imageSrc = getActivityImgSrc(activity);
              const isSpotify = activity.type === 2 && activity.name === 'Spotify';
              const title =
                (activity.type === 0 ? activity.name : activity.details || activity.name) ||
                'Activity';
              const trackId = activity.sync_id || raw?.spotify?.track_id;
              const label = activityLabel[activity.type] || 'Activity';
              const heading =
                activity.type === 2 && activity.name ? `${label} ${activity.name}` : label;

              return (
                <article className="dc-activity" key={activity.id || `${activity.name}-${index}`}>
                  <div className="dc-activity-heading">
                    <span className="dc-activity-label">
                      {heading}
                      {isSpotify && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-label="Spotify"
                          role="img"
                        >
                          <circle cx="12" cy="12" r="12" />
                          <path
                            d="M6 9c4-1 8-.5 12 1M7 12c3-1 7-.5 10 1M8 15c3-.7 5-.3 8 .7"
                            fill="none"
                            stroke="var(--dc-activity-bg)"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                    {isSpotify && trackId && (
                      <a
                        className="dc-activity-link"
                        href={`https://open.spotify.com/track/${encodeURIComponent(trackId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Listen to ${title} on Spotify`}
                        title="Listen on Spotify"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div className="dc-activity-content">
                    <ActivityArtwork src={imageSrc} alt="" isGame={activity.type === 0} />
                    <div className="dc-activity-copy">
                      <div className="dc-activity-title" title={title}>
                        {title}
                      </div>
                      {activity.type === 0 && activity.details && (
                        <div className="dc-activity-state" title={activity.details}>
                          {activity.details}
                        </div>
                      )}
                      {activity.state && <div className="dc-activity-state">{activity.state}</div>}
                      {activity.type !== 0 && activity.details && activity.name && !isSpotify && (
                        <div className="dc-activity-source">{activity.name}</div>
                      )}
                      {timing?.total ? (
                        <div className="dc-activity-timing">
                          <span>{timing.elapsed}</span>
                          <span
                            className="dc-activity-progress"
                            role="progressbar"
                            aria-label={`${title} progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(timing.progress * 100)}
                          >
                            <span style={{ width: `${timing.progress * 100}%` }} />
                          </span>
                          <span>{timing.total}</span>
                        </div>
                      ) : timing?.elapsed ? (
                        <div className="dc-activity-game-time">
                          <ActivityIcon />
                          <span>{timing.elapsed}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
