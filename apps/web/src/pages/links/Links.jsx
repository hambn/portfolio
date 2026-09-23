// Links.jsx — social cards page.
// Each card and its styles live in their own folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import '../../components/card/cards.css';
import './link-cards.css';
import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api.js';
import { PortfolioData } from '../../lib/data.js';
import ErrorState from '../../components/ErrorState.jsx';
import ErrorBoundary from '../../components/ErrorBoundary.jsx';
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

// Cards render provider data this site does not control; a field in an
// unexpected shape hides that one card instead of the whole page.
function Guarded({ children }) {
  return React.Children.toArray(children).map((card) => (
    <ErrorBoundary key={card.key}>{card}</ErrorBoundary>
  ));
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

  const wrap = { maxWidth: '760px', margin: '0 auto', padding: '88px 24px 80px' };

  if (error)
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>
          links
        </h1>
        <ErrorState message="failed to load links." onRetry={() => setAttempt((a) => a + 1)} />
      </main>
    );

  if (!config)
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>
          links
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>loading...</p>
      </main>
    );

  return (
    <main style={wrap}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>
          links
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>
          find me around the web
        </p>
      </div>

      {/* Order: Email, Discord, Telegram, X, GitHub, GitLab, LinkedIn, Spotify, Steam */}
      {/* One /links request seeds every card below; see LinksFeed.jsx. */}
      <LinksFeed config={config}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Guarded>
            {config.email && <EmailCard address={config.email.address} />}

            {config.discord && (
              <DiscordCard
                userId={config.discord.userId}
                apiEndpoint={config.discord.apiEndpoint || apiUrl('/discord')}
              />
            )}

            {config.telegram && (
              <TelegramCard
                username={config.telegram.username}
                handle={config.telegram.handle}
                url={config.telegram.url}
                apiEndpoint={config.telegram.apiEndpoint || apiUrl('/telegram')}
              />
            )}

            {config.x && <XCard handle={config.x.handle} url={config.x.url} />}

            {config.github && (
              <GitHubCard username={config.github.username} url={config.github.url} />
            )}

            {config.gitlab && (
              <GitLabCard username={config.gitlab.username} url={config.gitlab.url} />
            )}

            {config.linkedin && (
              <LinkedInCard handle={config.linkedin.handle} url={config.linkedin.url} />
            )}

            {config.spotify?.userId &&
              (config.spotify?.apiEndpoint ? (
                <SpotifyCard
                  userId={config.spotify.userId}
                  apiEndpoint={config.spotify.apiEndpoint}
                />
              ) : (
                <SpotifySimpleCard userId={config.spotify.userId} />
              ))}

            {config.steam && (
              <SteamCard
                handle={config.steam.handle}
                url={config.steam.url}
                apiEndpoint={config.steam.apiEndpoint}
              />
            )}
          </Guarded>
        </div>
      </LinksFeed>
    </main>
  );
}
