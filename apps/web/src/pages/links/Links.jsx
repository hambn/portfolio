// Links.jsx — social cards page.
// Each card and its styles live in their own folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import '../../components/card/cards.css';
import './link-cards.css';
import './link-fonts.css';
import React, { useMemo } from 'react';
import { apiUrl } from '../../lib/api.js';
import { useContent } from '../../hooks/useContent.js';
import ErrorState from '../../components/ErrorState.jsx';
import ErrorBoundary from '../../components/ErrorBoundary.jsx';
import JumpBar from './JumpBar.jsx';
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
      node: <DiscordCard userId={config.discord.userId} apiEndpoint={config.discord.apiEndpoint} />,
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
export default function Links() {
  const { data: config, error, retry } = useContent('links');

  const cards = useMemo(() => (config ? cardList(config) : []), [config]);

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
