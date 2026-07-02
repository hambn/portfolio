// Links.jsx — social cards page.
// Each card lives in its own file in this folder; config comes from
// contents/links/links.json (no hardcoded IDs/handles here).
import { EmailCard } from './EmailCard.jsx';
import { DiscordCard } from './DiscordCard.jsx';
import { TelegramCard } from './TelegramCard.jsx';
import { XCard } from './XCard.jsx';
import { GitHubCard } from './GitHubCard.jsx';
import { GitLabCard } from './GitLabCard.jsx';
import { LinkedInCard } from './LinkedInCard.jsx';
import { SpotifyCard, SpotifySimpleCard } from './SpotifyCard.jsx';
import { SteamCard } from './SteamCard.jsx';

const { useState, useEffect } = React;

function Links() {
  const [config,      setConfig]      = useState(null);
  const [lanyardData, setLanyardData] = useState(null);

  useEffect(() => {
    window.PortfolioData.getLinks().then(setConfig).catch(() => {});
  }, []);

  // Lanyard WebSocket for real-time presence (INIT_STATE arrives on subscribe)
  useEffect(() => {
    const userId = config?.discord?.userId;
    if (!userId) return;

    let ws, heartbeat, cancelled = false;

    function connect() {
      if (cancelled) return;
      ws = new WebSocket('wss://api.lanyard.rest/socket');

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const { op, d } = msg;

        if (op === 1) {
          heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 3 }));
          }, d.heartbeat_interval);
          ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
        }

        if (op === 0 && d) setLanyardData(d);
      };

      ws.onclose = () => {
        clearInterval(heartbeat);
        if (!cancelled) setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      try { ws.close(); } catch (_) {}
    };
  }, [config?.discord?.userId]);

  const wrap = { maxWidth: '760px', margin: '0 auto', padding: '88px 24px 80px' };

  if (!config) return (
    <main style={wrap}>
      <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>links</h2>
      <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>loading...</p>
    </main>
  );

  return (
    <main style={wrap}>
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: '700', marginBottom: '6px' }}>links</h2>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 'var(--text-sm)' }}>find me around the web</p>
      </div>

      {/* Order: Email, Discord, Telegram, X, GitHub, GitLab, LinkedIn, Spotify, Steam */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {config.email && <EmailCard address={config.email.address}/>}

        {config.discord && (
          <DiscordCard userId={config.discord.userId} lanyardData={lanyardData}
            apiEndpoint={config.discord.apiEndpoint || 'https://api.portfolio.hgh.dev/discord'}/>
        )}

        {config.telegram && <TelegramCard handle={config.telegram.handle} url={config.telegram.url}/>}

        {config.x && <XCard handle={config.x.handle} url={config.x.url}/>}

        {config.github && <GitHubCard username={config.github.username} url={config.github.url}/>}

        {config.gitlab && <GitLabCard username={config.gitlab.username} url={config.gitlab.url}/>}

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

        {config.spotify?.userId && (
          config.spotify?.apiEndpoint
            ? <SpotifyCard userId={config.spotify.userId} apiEndpoint={config.spotify.apiEndpoint}/>
            : <SpotifySimpleCard userId={config.spotify.userId}/>
        )}

        {config.steam && <SteamCard handle={config.steam.handle} url={config.steam.url} apiEndpoint={config.steam.apiEndpoint}/>}

      </div>
    </main>
  );
}

Object.assign(window, { Links });
