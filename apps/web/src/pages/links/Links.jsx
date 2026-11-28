// Links.jsx — social cards page.
// Each card and its styles live in their own folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import '../../components/card/cards.css';
import './link-cards.css';
import './link-fonts.css';
import React, { useEffect, useMemo } from 'react';
import { apiUrl } from '../../lib/api.js';
import { EXTERNAL } from '../../lib/external.js';
import { writeCollapsed } from '../../lib/cardState.js';
import { findLinkService } from '../../lib/linksDirectory.js';
import { useSiteCard } from '../../lib/siteFeed.js';
import { useContent } from '../../hooks/useContent.js';
import ErrorState from '../../components/ErrorState.jsx';
import ErrorBoundary from '../../components/ErrorBoundary.jsx';
import Icon from '../../components/Icon.jsx';
import JumpBar, { pulseCard } from './JumpBar.jsx';
import { LinksFeed } from './LinksFeed.jsx';
import { EmailCard } from './email/EmailCard.jsx';
import { DiscordCard } from './discord/DiscordCard.jsx';
import { TelegramCard } from './telegram/TelegramCard.jsx';
import { XCard } from './x/XCard.jsx';
import { GitHubCard } from './github/GitHubCard.jsx';
import { GitLabCard } from './gitlab/GitLabCard.jsx';
import { LinkedInCard } from './linkedin/LinkedInCard.jsx';
import { SpotifyCard, SpotifySimpleCard } from './spotify/SpotifyCard.jsx';
import { SteamCard } from './steam/SteamCard.jsx';

// Fetches the cards' images ahead of a visit; called by warmPages().
export { warm } from './warm.js';

const PRESENCE_LABEL = {
  online: 'online on discord',
  idle: 'idle on discord',
  dnd: 'busy on discord',
};

function cardList(config) {
  return [
    config.email && {
      id: 'email',
      slug: 'email',
      label: 'Email',
      node: <EmailCard address={config.email.address} />,
    },
    config.discord && {
      id: 'dc',
      slug: 'discord',
      label: 'Discord',
      node: <DiscordCard userId={config.discord.userId} apiEndpoint={config.discord.apiEndpoint} />,
    },
    config.telegram && {
      id: 'tg',
      slug: 'telegram',
      label: 'Telegram',
      node: (
        <TelegramCard
          username={config.telegram.username}
          handle={config.telegram.handle}
          url={config.telegram.url}
          apiEndpoint={config.telegram.apiEndpoint || apiUrl('/telegram')}
        />
      ),
    },
    config.x && {
      id: 'x',
      slug: 'x',
      label: 'X',
      node: <XCard handle={config.x.handle} url={config.x.url} />,
    },
    config.github && {
      id: 'gh',
      slug: 'github',
      label: 'GitHub',
      node: (
        <GitHubCard
          username={config.github.username}
          url={config.github.url}
          api={Boolean(config.github.apiEndpoint)}
        />
      ),
    },
    config.gitlab && {
      id: 'gl',
      slug: 'gitlab',
      label: 'GitLab',
      node: (
        <GitLabCard
          username={config.gitlab.username}
          url={config.gitlab.url}
          api={Boolean(config.gitlab.apiEndpoint)}
        />
      ),
    },
    config.linkedin && {
      id: 'li',
      slug: 'linkedin',
      label: 'LinkedIn',
      node: <LinkedInCard handle={config.linkedin.handle} url={config.linkedin.url} />,
    },
    config.spotify?.userId && {
      id: 'sp',
      slug: 'spotify',
      label: 'Spotify',
      node: config.spotify.apiEndpoint ? (
        <SpotifyCard userId={config.spotify.userId} apiEndpoint={config.spotify.apiEndpoint} />
      ) : (
        <SpotifySimpleCard userId={config.spotify.userId} />
      ),
    },
    config.steam && {
      id: 'st',
      slug: 'steam',
      label: 'Steam',
      node: (
        <SteamCard
          handle={config.steam.handle}
          url={config.steam.url}
          apiEndpoint={config.steam.apiEndpoint}
        />
      ),
    },
  ].filter(Boolean);
}

export default function Links({ route }) {
  const { data: config, error, retry } = useContent('links');
  const { data: profile } = useContent('profile');
  const discordFeed = useSiteCard('discord');
  const cards = useMemo(() => (config ? cardList(config) : []), [config]);
  const serviceSlug = (route || '').split('/')[1] || '';
  const focusedService = useMemo(
    () => (config && serviceSlug ? findLinkService(config, serviceSlug, profile) : null),
    [config, serviceSlug, profile],
  );

  // Deep-link support: `/links/<service>/`, `/links/?card=discord`, or `/links/#card-dc`.
  useEffect(() => {
    if (!cards.length) return;
    const param = new URLSearchParams(window.location.search).get('card')?.toLowerCase() || '';
    const hash = window.location.hash.replace(/^#card-/, '').toLowerCase();
    const target =
      cards.find((c) => c.slug === serviceSlug) ||
      cards.find((c) => c.slug === param || c.id === param) ||
      cards.find((c) => c.id === hash || c.slug === hash);
    if (!target) return;
    writeCollapsed(`${target.id}_card_collapsed`, false);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`card-${target.id}`);
      if (!el) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      pulseCard(el);
    });
  }, [cards, serviceSlug]);

  const rawStatus =
    discordFeed.status === 'ready'
      ? discordFeed.data?.status || discordFeed.data?.discord_status
      : null;
  const liveStatus = rawStatus && PRESENCE_LABEL[rawStatus] ? rawStatus : null;

  if (error)
    return (
      <main className="links-page">
        <h1 className="links-title">links</h1>
        <ErrorState message="failed to load links." onRetry={retry} />
      </main>
    );

  if (!config)
    return (
      <main className="links-page">
        <h1 className="links-title">links</h1>
        <p className="links-sub">loading...</p>
      </main>
    );

  return (
    <main className="links-page">
      <div className="links-head">
        <div className="links-head-top">
          <div>
            <h1 className="links-title">links</h1>
            <p className="links-sub">find me around the web</p>
          </div>
          {liveStatus && (
            <button
              type="button"
              className="links-live-pill"
              onClick={() => {
                const el = document.getElementById('card-dc');
                if (!el) return;
                writeCollapsed('dc_card_collapsed', false);
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                pulseCard(el);
              }}
            >
              <span className={`links-live-dot is-${liveStatus}`} aria-hidden="true" />
              {PRESENCE_LABEL[liveStatus]}
            </button>
          )}
        </div>

        {focusedService && (
          <div className="links-redirect-banner" style={{ '--svc-accent': focusedService.accent }}>
            <div className="links-redirect-copy">
              <span className="links-redirect-badge">/links/{focusedService.slug}</span>
              <span>
                {focusedService.label} · {focusedService.handle}
              </span>
            </div>
            <a
              className="links-redirect-btn"
              href={focusedService.url}
              {...(focusedService.url.startsWith('mailto:') ? {} : EXTERNAL)}
            >
              open {focusedService.label.toLowerCase()}
              <Icon name="arrow-up-right" />
            </a>
          </div>
        )}
      </div>

      <JumpBar cards={cards} />

      {/* One /links request seeds every card below; see LinksFeed.jsx. */}
      <LinksFeed config={config}>
        <div className="links-list">
          {/* Cards render provider data this site does not control; a field in
              an unexpected shape hides that one card instead of the whole page. */}
          {cards.map((card) => (
            <div key={card.id} id={`card-${card.id}`} className="links-item">
              <ErrorBoundary>{card.node}</ErrorBoundary>
            </div>
          ))}
        </div>
      </LinksFeed>
    </main>
  );
}
