// Links.jsx — social cards page.
// Each card and its styles live in their own folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import '../../components/card/cards.css';
import './link-cards.css';
import './link-fonts.css';
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { apiUrl } from '../../lib/api.js';
import { PortfolioData } from '../../lib/data.js';
import { readCollapsed, subscribeCollapsed, writeCollapsed } from '../../lib/cardState.js';
import ErrorState from '../../components/ErrorState.jsx';
import ErrorBoundary from '../../components/ErrorBoundary.jsx';
import Icon from '../../components/Icon.jsx';
import { BRAND_ICON } from './brandIcons.js';
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

// Every card the config asks for, in page order. `id` is the card's
// collapsed-state prefix (lib/cardState.js), `label` its name in the jump bar,
// spelled the way the service spells it.
function cardList(config) {
  return [
    config.email && {
      id: 'email',
      label: 'Email',
      node: <EmailCard address={config.email.address} />,
    },
    config.discord && {
      id: 'dc',
      label: 'Discord',
      node: (
        <DiscordCard
          userId={config.discord.userId}
          apiEndpoint={config.discord.apiEndpoint || apiUrl('/discord')}
        />
      ),
    },
    config.telegram && {
      id: 'tg',
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
      label: 'X',
      node: <XCard handle={config.x.handle} url={config.x.url} />,
    },
    config.github && {
      id: 'gh',
      label: 'GitHub',
      node: <GitHubCard username={config.github.username} url={config.github.url} />,
    },
    config.gitlab && {
      id: 'gl',
      label: 'GitLab',
      node: <GitLabCard username={config.gitlab.username} url={config.gitlab.url} />,
    },
    config.linkedin && {
      id: 'li',
      label: 'LinkedIn',
      node: <LinkedInCard handle={config.linkedin.handle} url={config.linkedin.url} />,
    },
    config.spotify?.userId && {
      id: 'sp',
      label: 'Spotify',
      node: config.spotify.apiEndpoint ? (
        <SpotifyCard userId={config.spotify.userId} apiEndpoint={config.spotify.apiEndpoint} />
      ) : (
        <SpotifySimpleCard userId={config.spotify.userId} />
      ),
    },
    config.steam && {
      id: 'st',
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

const collapsedKey = (id) => `${id}_card_collapsed`;

// The ids of the collapsed cards as one string, so the jump bar re-renders the
// moment any card opens or shuts, wherever the click came from.
function useCollapsedIds(cards) {
  const subscribe = useCallback(
    (notify) => {
      const stops = cards.map((card) => subscribeCollapsed(collapsedKey(card.id), notify));
      return () => stops.forEach((stop) => stop());
    },
    [cards],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      cards
        .filter((card) => readCollapsed(collapsedKey(card.id)))
        .map((card) => card.id)
        .join(' '),
    () => '',
  );
}

// A touch longer than the body's open transition in cards.css.
const OPEN_MS = 440;

// Whether the card already sits where a jump would put it: near the top of the
// view, or as far up as the end of the page lets it go.
function inPlace(el) {
  const top = el.getBoundingClientRect().top;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const page = document.documentElement;
  const atEnd = window.innerHeight + window.scrollY >= page.scrollHeight - 2;
  return top >= margin - 12 && (top < window.innerHeight * 0.6 || atEnd);
}

// One chip per card. A chip brings its card into view and opens it; pressed
// again while that card is in place, it collapses the card without moving.
function JumpBar({ cards }) {
  const collapsed = useCollapsedIds(cards).split(' ').filter(Boolean);
  const allCollapsed = collapsed.length === cards.length;
  const jump = (id) => {
    const el = document.getElementById(`card-${id}`);
    if (!el) return;
    const key = collapsedKey(id);
    const opening = readCollapsed(key);
    if (opening) writeCollapsed(key, false);
    else if (inPlace(el)) return writeCollapsed(key, true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    go();
    // A card near the end of the page has nowhere to scroll to until it has
    // opened, so aim again once its body has finished growing (cards.css).
    if (opening) setTimeout(go, OPEN_MS);
  };
  const setAll = () => {
    for (const card of cards) writeCollapsed(collapsedKey(card.id), !allCollapsed);
  };
  return (
    <nav className="links-jump" aria-label="link cards">
      <div className="links-jump-list">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="links-jump-item"
            data-card={card.id}
            aria-label={card.label}
            aria-expanded={!collapsed.includes(card.id)}
            aria-controls={`card-${card.id}`}
            onClick={() => jump(card.id)}
          >
            <svg className="links-jump-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={BRAND_ICON[card.id]} />
            </svg>
            <span className="links-jump-label">{card.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="links-jump-item links-jump-all"
          title={allCollapsed ? 'expand all' : 'collapse all'}
          onClick={setAll}
        >
          <Icon name={allCollapsed ? 'expand' : 'collapse'} />
          <span className="links-jump-label">{allCollapsed ? 'expand' : 'collapse'}</span>
        </button>
      </div>
    </nav>
  );
}

export default function Links() {
  const [config, setConfig] = useState(() => PortfolioData.peek('links'));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    PortfolioData.getLinks()
      .then((d) => {
        if (alive) setConfig(d);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const cards = useMemo(() => (config ? cardList(config) : []), [config]);

  if (error)
    return (
      <main className="links-page">
        <h1 className="links-title">links</h1>
        <ErrorState message="failed to load links." onRetry={() => setAttempt((a) => a + 1)} />
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
        <h1 className="links-title">links</h1>
        <p className="links-sub">find me around the web</p>
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
