import React, { useId, useState } from 'react';
import '@fontsource-variable/dm-sans';
import './SpotifyCard.css';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { useSpotifyPlayback } from './useSpotifyPlayback.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';

const SP_PATH =
  'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';

const TABS = [
  { id: 'recent', label: 'Recently played' },
  { id: 'tracks', label: 'Top tracks' },
  { id: 'artists', label: 'Top artists' },
  { id: 'playlists', label: 'Playlists' },
];
function SpIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={SP_PATH} />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6M10 14 21 3M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}
function ExternalLink({ href, children, ...props }) {
  return (
    <a
      href={href || 'https://open.spotify.com'}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}
function formatTime(ms = 0) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function timeAgo(iso) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
function Artwork({ images, className = '', name = '' }) {
  const url = images?.[0]?.url;
  return url ? (
    <img className={`sp-art ${className}`} src={url} alt={name} loading="lazy" />
  ) : (
    <span className={`sp-art sp-art-placeholder ${className}`} aria-hidden="true">
      ♫
    </span>
  );
}
function Artists({ artists }) {
  return (
    <span className="sp-artists">
      {artists?.map((artist, i) => (
        <React.Fragment key={artist.id || i}>
          {i > 0 && ', '}
          <ExternalLink href={artist.external_urls?.spotify}>{artist.name}</ExternalLink>
        </React.Fragment>
      ))}
    </span>
  );
}
function Equalizer() {
  return (
    <span className="sp-equalizer" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
function TrackList({ items, recent = false }) {
  if (!items?.length)
    return (
      <p className="sp-empty">No {recent ? 'recent listening activity' : 'top tracks'} yet.</p>
    );
  return (
    <div className="sp-track-list">
      {items.slice(0, 6).map((entry, i) => {
        const track = recent ? entry.track : entry;
        if (!track) return null;
        return (
          <div className="sp-track-row" key={`${track.id}-${i}`}>
            <span className="sp-track-rank">{i + 1}</span>
            <ExternalLink
              href={track.external_urls?.spotify}
              aria-label={`Open ${track.name} on Spotify`}
            >
              <Artwork images={track.album?.images} />
            </ExternalLink>
            <div className="sp-track-copy">
              <ExternalLink className="sp-track-title" href={track.external_urls?.spotify}>
                {track.name}
              </ExternalLink>
              <Artists artists={track.artists} />
            </div>
            {recent && <span className="sp-track-ago">{timeAgo(entry.played_at)}</span>}
            <span className="sp-track-duration">{formatTime(track.duration_ms)}</span>
          </div>
        );
      })}
    </div>
  );
}
function Collection({ items, artists = false }) {
  if (!items?.length)
    return <p className="sp-empty">No {artists ? 'top artists' : 'public playlists'} yet.</p>;
  return (
    <div className="sp-collection">
      {items.map((item) => (
        <ExternalLink
          className={`sp-tile ${artists ? 'sp-tile-artist' : ''}`}
          key={item.id}
          href={item.external_urls?.spotify}
        >
          <Artwork images={item.images} />
          <span className="sp-tile-title">{item.name}</span>
          <span className="sp-tile-subtitle">
            {artists
              ? 'Artist'
              : item.tracks?.total != null
                ? `${item.tracks.total} tracks`
                : 'Playlist'}
          </span>
        </ExternalLink>
      ))}
    </div>
  );
}
function NowPlaying({ item, progress, playing, context, playlist }) {
  const duration = item.duration_ms || 0;
  const elapsed = Math.min(progress, duration);
  const playlistUrl =
    playlist?.url || (context?.type === 'playlist' && context.external_urls?.spotify);
  return (
    <section className="sp-player" aria-label={playing ? 'Now playing' : 'Last played'}>
      <div className="sp-player-heading">
        {playing ? <Equalizer /> : <SpIcon size={16} />}
        <span>{playing ? 'Now playing' : 'Last played'}</span>
        <span className="sp-player-status">{playing ? 'Listening on Spotify' : 'Not playing'}</span>
      </div>
      <div className="sp-player-track">
        <ExternalLink
          href={item.album?.external_urls?.spotify}
          aria-label={`Open ${item.album?.name || item.name} on Spotify`}
        >
          <Artwork images={item.album?.images} className="sp-player-art" />
        </ExternalLink>
        <div className="sp-player-copy">
          <ExternalLink className="sp-player-title" href={item.external_urls?.spotify}>
            {item.name}
          </ExternalLink>
          <Artists artists={item.artists} />
          {item.album?.name && (
            <ExternalLink
              className="sp-player-album"
              href={
                item.album.external_urls?.spotify ||
                (item.album.id ? `https://open.spotify.com/album/${item.album.id}` : undefined)
              }
            >
              <span className="sp-album-label">Album · </span>
              {item.album.name}
            </ExternalLink>
          )}
          <ExternalLink className="sp-listen" href={item.external_urls?.spotify}>
            <SpIcon size={16} />
            Listen on Spotify<span aria-hidden="true">↗</span>
          </ExternalLink>
        </div>
      </div>
      {playing && duration > 0 && (
        <div className="sp-timeline">
          <span>{formatTime(elapsed)}</span>
          <div
            className="sp-progress"
            role="progressbar"
            aria-label="Track progress"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={elapsed}
            aria-valuetext={`${formatTime(elapsed)} of ${formatTime(duration)}`}
          >
            <span style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }} />
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      )}
      {playlistUrl && (
        <ExternalLink className="sp-context" href={playlistUrl}>
          <Artwork images={playlist?.images} />
          <span className="sp-context-copy">
            <span className="sp-context-label">
              <SpIcon size={12} />
              Playing from playlist
            </span>
            <span className="sp-context-name">{playlist?.name || 'View playlist'}</span>
            {playlist?.totalTracks != null && (
              <span className="sp-context-meta">
                {playlist.totalTracks.toLocaleString()} tracks
              </span>
            )}
          </span>
          <span className="sp-context-arrow">
            <ExternalIcon />
          </span>
        </ExternalLink>
      )}
    </section>
  );
}
export function SpotifySimpleCard({ userId }) {
  return (
    <ExternalLink className="sp-simple-card" href={`https://open.spotify.com/user/${userId}`}>
      <SpIcon size={32} />
      <span>
        <strong>Spotify</strong>
        <span className="sp-simple-handle">@{userId}</span>
      </span>
      <span className="sp-simple-open">Open profile ↗</span>
    </ExternalLink>
  );
}
export function SpotifyCard({ userId, apiEndpoint }) {
  const { data, progress, loading, error } = useSpotifyPlayback(apiEndpoint);
  const [tab, setTab] = useState('recent');
  const [collapsed, toggleCollapse] = useCollapsed('sp_card_collapsed');
  const id = useId();
  const profile = data?.profile;
  const status = data?.status;
  const playing = Boolean(status?.is_playing && status?.item);
  const item = status?.item || data?.recent?.items?.[0]?.track;
  const href =
    profile?.external_urls?.spotify ||
    (userId ? `https://open.spotify.com/user/${userId}` : 'https://open.spotify.com');
  const [copied, copy] = useCopy(href);
  function onTabKey(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setTab(TABS[next].id);
    event.currentTarget.parentElement.children[next].focus();
  }
  return (
    <article className="sp-card" aria-label="Spotify listening activity">
      <header className="sp-card-header">
        <ExternalLink className="sp-brand" href={href}>
          <SpIcon size={25} />
          <span>Spotify</span>
        </ExternalLink>
        <div className="sp-header-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn sp-hdr-btn"
            labelClass="sp-header-label"
            accent="#1ed760"
            copied={copied}
            onCopy={copy}
            copyTitle="Copy Spotify profile link"
            copyLabel="copy profile link"
            href={href}
            openLabel="open in spotify"
            openTitle="Open in Spotify"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </header>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        {profile && (
          <section className="sp-profile">
            <ExternalLink href={href} aria-label="Open Spotify profile">
              <Artwork className="sp-avatar" images={profile.images} />
            </ExternalLink>
            <div className="sp-profile-copy">
              <span className="sp-eyebrow">Public profile</span>
              <ExternalLink className="sp-profile-name" href={href}>
                {profile.display_name || userId}
              </ExternalLink>
              <div className="sp-profile-meta">
                {profile.followers?.total != null && (
                  <span>
                    <strong>{profile.followers.total.toLocaleString()}</strong> followers
                  </span>
                )}
                {data?.playlists?.length > 0 && (
                  <span>
                    <strong>{data.playlists.length}</strong> public playlists
                  </span>
                )}
              </div>
            </div>
            <ExternalLink
              className="sp-profile-open"
              href={href}
              aria-label="Open profile on Spotify"
            >
              View profile <ExternalIcon />
            </ExternalLink>
          </section>
        )}
        {!data && (
          <div className="sp-empty" role="status">
            {error
              ? 'Listening activity is unavailable right now.'
              : loading
                ? 'Loading listening activity…'
                : 'No listening activity yet.'}
          </div>
        )}
        {data && (
          <>
            {item ? (
              <NowPlaying
                key={item.id || item.uri}
                item={item}
                progress={progress}
                playing={playing}
                context={playing ? status?.context : null}
                playlist={playing ? status?.contextPlaylist : null}
              />
            ) : (
              <p className="sp-empty">Not playing anything right now.</p>
            )}
            <div className="sp-library">
              <div className="sp-tabs" role="tablist" aria-label="Listening history">
                {TABS.map((entry, index) => (
                  <button
                    key={entry.id}
                    id={`${id}-${entry.id}`}
                    role="tab"
                    aria-selected={tab === entry.id}
                    aria-controls={`${id}-panel`}
                    tabIndex={tab === entry.id ? 0 : -1}
                    onClick={() => setTab(entry.id)}
                    onKeyDown={(event) => onTabKey(event, index)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <section
                className="sp-tab-panel"
                role="tabpanel"
                id={`${id}-panel`}
                aria-labelledby={`${id}-${tab}`}
                tabIndex={0}
              >
                <div className="sp-section-heading">
                  <h3>{TABS.find((entry) => entry.id === tab).label}</h3>
                  <span>
                    {tab === 'recent'
                      ? 'On repeat & rediscovered'
                      : tab === 'playlists'
                        ? 'Made for listening'
                        : 'In heavy rotation'}
                  </span>
                </div>
                {tab === 'recent' && <TrackList items={data.recent?.items} recent />}
                {tab === 'tracks' && <TrackList items={data.topTracks?.items} />}
                {tab === 'artists' && <Collection items={data.topArtists?.items} artists />}
                {tab === 'playlists' && <Collection items={data.playlists} />}
              </section>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
