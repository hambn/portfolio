// Links.jsx — social cards page.
// Each card and its styles live in their own folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import '../../components/card/cards.css';
import './link-cards.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import ErrorState from '../../components/ErrorState.jsx';
import { EmailCard } from './email/EmailCard.jsx';
import { DiscordCard } from './discord/DiscordCard.jsx';
import { TelegramCard } from './telegram/TelegramCard.jsx';
import { XCard } from './x/XCard.jsx';
import { GitHubCard } from './github/GitHubCard.jsx';
import { GitLabCard } from './gitlab/GitLabCard.jsx';
import { LinkedInCard } from './linkedin/LinkedInCard.jsx';
import { SpotifyCard, SpotifySimpleCard } from './spotify/SpotifyCard.jsx';
import { SteamCard } from './steam/SteamCard.jsx';

export default function Links() {
  const [config, setConfig] = useState(() => PortfolioData.peek('links'));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lanyardData, setLanyardData] = useState(null);

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

  // Lanyard WebSocket for real-time presence (INIT_STATE arrives on subscribe)
  useEffect(() => {
    const userId = config?.discord?.userId;
    if (!userId) return;

    let ws;
    let heartbeat;
    let reconnect;
    let handshake;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      clearTimeout(reconnect);
      clearTimeout(handshake);
      clearInterval(heartbeat);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
      }
      setLanyardData(null);
      const socket = new WebSocket('wss://api.lanyard.rest/socket');
      ws = socket;
      // A socket can remain CONNECTING after a network change.
      handshake = setTimeout(() => socket.close(), 15000);
      socket.onmessage = (event) => {
        if (cancelled || socket !== ws) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        const { op, d } = message;
        if (op === 1) {
          clearInterval(heartbeat);
          heartbeat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ op: 3 }));
          }, d.heartbeat_interval);
          socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
        }
        if (op === 0 && d) {
          clearTimeout(handshake);
          setLanyardData(d);
        }
      };
      socket.onclose = () => {
        clearInterval(heartbeat);
        clearTimeout(handshake);
        if (!cancelled) {
          setLanyardData(null);
          reconnect = setTimeout(connect, 4000);
        }
      };
      socket.onerror = () => socket.close();
    }

    function resume() {
      if (document.visibilityState === 'visible') connect();
    }

    connect();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearTimeout(handshake);
      clearTimeout(reconnect);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [config?.discord?.userId]);

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {config.email && <EmailCard address={config.email.address} />}

        {config.discord && (
          <DiscordCard
            userId={config.discord.userId}
            lanyardData={lanyardData}
            apiEndpoint={config.discord.apiEndpoint || 'https://api.portfolio.hgh.dev/discord'}
          />
        )}

        {config.telegram && (
          <TelegramCard
            username={config.telegram.username || config.telegram.handle || config.telegram.url}
            handle={config.telegram.handle}
            url={config.telegram.url}
            apiEndpoint={config.telegram.apiEndpoint || 'https://api.portfolio.hgh.dev/telegram'}
          />
        )}

        {config.x && <XCard handle={config.x.handle} url={config.x.url} />}

        {config.github && <GitHubCard username={config.github.username} url={config.github.url} />}

        {config.gitlab && <GitLabCard username={config.gitlab.username} url={config.gitlab.url} />}

        {config.linkedin && (
          <LinkedInCard
            handle={config.linkedin.handle}
            url={config.linkedin.url}
            name={config.linkedin.name}
            headline={config.linkedin.headline}
            location={config.linkedin.location}
            connections={config.linkedin.connections}
            followers={config.linkedin.followers}
            banner={config.linkedin.banner}
            avatar={config.linkedin.avatar}
          />
        )}

        {config.spotify?.userId &&
          (config.spotify?.apiEndpoint ? (
            <SpotifyCard userId={config.spotify.userId} apiEndpoint={config.spotify.apiEndpoint} />
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
      </div>
    </main>
  );
}
