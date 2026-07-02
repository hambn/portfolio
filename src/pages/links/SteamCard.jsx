// SteamCard.jsx — Steam card, API endpoint driven
// NOTE: all internal components are prefixed "St" to avoid scope collision with
// other Babel scripts (SpotifyCard defines RecentSection, etc. in the same window).
import { useCollapsed, useCopy, usePolledJSON, HeaderButtons } from './shared.jsx';

const { useState } = React;

// ── One-time CSS ───────────────────────────────────────────────────────────────
let _stStyleDone = false;
function ensureStStyles() {
  if (_stStyleDone) return;
  _stStyleDone = true;
  const el = document.createElement('style');
  el.textContent = `
    .st-hdr-btn{opacity:0.55;transition:opacity 0.12s,color 0.12s;background:none;border:none;cursor:pointer;
      display:flex;align-items:center;gap:5px;color:#8f98a0;padding:4px 7px;border-radius:4px;
      font-size:11px;font-family:inherit;white-space:nowrap;}
    .st-hdr-btn:hover{opacity:1;color:#c7d5e0;}
    .st-game-row{transition:background 0.1s;}
    .st-game-row:hover{background:rgba(102,192,244,0.07);border-radius:5px;}
    .st-body{overflow:hidden;transition:max-height 0.4s ease,opacity 0.25s ease;}
    .st-body.open{max-height:4000px;opacity:1;}
    .st-body.closed{max-height:0;opacity:0;pointer-events:none;}
    .st-open-btn{transition:background 0.15s,color 0.15s,border-color 0.15s;}
    .st-open-btn:hover{background:rgba(102,192,244,0.15) !important;color:#fff !important;border-color:#66c0f4 !important;}
    .st-hero-img{transition:transform 0.2s;}
    .st-hero-link:hover .st-hero-img{transform:scale(1.02);}
    @media(max-width:540px){
      .st-hdr-label{display:none;}
      .st-hdr-btn{padding:4px 5px;}
      .st-open-label{display:none;}
    }
  `;
  document.head.appendChild(el);
}

// ── Palette (always dark — Steam brand) ───────────────────────────────────────
const ST = {
  bg:     'linear-gradient(155deg,#1b2838 0%,#2a475e 55%,#1b2838 100%)',
  bgHead: 'rgba(0,0,0,0.45)',
  border: '#3d5a73',
  div:    'rgba(61,90,115,0.45)',
  blue:   '#66c0f4',
  white:  '#c7d5e0',
  muted:  '#8f98a0',
  faint:  '#4f6a7a',
  surf:   'rgba(102,192,244,0.07)',
  ingame: '#90ba3c',
  online: '#57cbde',
};

// ── Steam icon ────────────────────────────────────────────────────────────────
const ST_ICON_PATH = 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z';

function StIcon({ size, color }) {
  return (
    <svg viewBox="0 0 24 24" fill={color || ST.blue} width={size || 16} height={size || 16} style={{ flexShrink:0, display:'block' }}>
      <path d={ST_ICON_PATH}/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stFmtHrs(h) {
  if (h == null) return null;
  const n = parseFloat(h);
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k hrs`;
  if (n < 1)     return `${Math.round(n * 60)} min`;
  return `${n % 1 === 0 ? n : n.toFixed(1)} hrs`;
}

// ── Game Row (prefixed to avoid window collision) ─────────────────────────────
function StGameRow({ game, rank, showRecent }) {
  if (!game) return null;
  const href = `https://store.steampowered.com/app/${game.appid}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="st-game-row"
      style={{ position:'relative', overflow:'hidden', display:'flex', gap:'12px', alignItems:'center', padding:'7px 8px', textDecoration:'none' }}>
      {/* library_hero as subtle background */}
      {game.images?.hero && (
        <img src={game.images.hero} alt="" aria-hidden="true"
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.13, pointerEvents:'none', display:'block' }}/>
      )}
      {rank != null && (
        <span style={{ position:'relative', width:'18px', textAlign:'right', fontSize:'12px', color:ST.faint, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{rank}</span>
      )}
      {game.images?.header
        ? <img src={game.images.header} alt={game.name}
            style={{ position:'relative', height:'36px', width:'auto', maxWidth:'80px', borderRadius:'3px', flexShrink:0, objectFit:'cover', display:'block' }}/>
        : <div style={{ position:'relative', width:'80px', height:'36px', borderRadius:'3px', background:ST.surf, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <StIcon size={16}/>
          </div>
      }
      <div style={{ position:'relative', flex:1, minWidth:0 }}>
        <div style={{ fontSize:'13px', fontWeight:'500', color:ST.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{game.name}</div>
        <div style={{ display:'flex', gap:'10px', marginTop:'3px', flexWrap:'wrap' }}>
          {showRecent && game.playtime_2weeks_hours != null && (
            <span style={{ fontSize:'11px', color:ST.blue }}>{stFmtHrs(game.playtime_2weeks_hours)} past 2 wks</span>
          )}
          {(game.playtime_total_hours != null || game.playtime_hours != null) && (
            <span style={{ fontSize:'11px', color:ST.muted }}>{stFmtHrs(game.playtime_total_hours ?? game.playtime_hours)} total</span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function StSectionLabel({ children }) {
  return (
    <div style={{ fontSize:'10px', color:ST.faint, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'10px' }}>
      {children}
    </div>
  );
}

// ── Recent Activity section ───────────────────────────────────────────────────
function StRecentSection({ items }) {
  if (!items?.length) return <p style={{ color:ST.faint, fontSize:'13px', margin:0 }}>no recent activity</p>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
      {items.map((game, i) => (
        <StGameRow key={game.appid || i} game={game} rank={i + 1} showRecent={true}/>
      ))}
    </div>
  );
}

// ── Favorite Game section ─────────────────────────────────────────────────────
function StFavoriteSection({ game }) {
  if (!game) return null;
  const href = `https://store.steampowered.com/app/${game.appid}`;
  return (
    <div>
      {(game.images?.hero || game.images?.header) && (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="st-hero-link"
          style={{ display:'block', borderRadius:'6px', overflow:'hidden', marginBottom:'12px' }}>
          <img
            className="st-hero-img"
            src={game.images.hero || game.images.header}
            alt={game.name}
            style={{ width:'100%', height:'120px', objectFit:'cover', display:'block' }}/>
        </a>
      )}
      <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
        {game.images?.header && (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
            <img src={game.images.header} alt="" style={{ height:'38px', width:'auto', maxWidth:'88px', borderRadius:'3px', display:'block', objectFit:'cover' }}/>
          </a>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', fontSize:'14px', fontWeight:'700', color:ST.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none', marginBottom:'3px' }}>
            {game.name}
          </a>
          {(game.playtime_hours != null || game.playtime_total_hours != null) && (
            <div style={{ fontSize:'12px', color:ST.blue }}>
              {stFmtHrs(game.playtime_hours ?? game.playtime_total_hours)} on record
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main SteamCard ────────────────────────────────────────────────────────────
export function SteamCard({ handle, url, apiEndpoint }) {
  ensureStStyles();

  const [data,      setData]      = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('st_card_collapsed');

  const profileUrl = data?.profileUrl || url || (handle ? `https://steamcommunity.com/id/${handle}/` : 'https://steamcommunity.com');
  const [copied, copyLink] = useCopy(profileUrl);
  const { loading, error } = usePolledJSON(apiEndpoint, 60000, (d) => setData(d));
  const isInGame   = !!data?.currentGame;
  const statusStr  = (data?.status || '').toLowerCase();
  const isOnline   = statusStr === 'online' || isInGame;
  const dotColor   = isInGame ? ST.ingame : (isOnline ? ST.online : ST.faint);
  const statusLabel = isInGame
    ? `In-Game`
    : (data?.status || 'offline');

  // ── Simple card ───────────────────────────────────────────────────────────
  if (!apiEndpoint) {
    return (
      <a href={url || `https://steamcommunity.com/id/${handle}/`} target="_blank" rel="noopener noreferrer"
        style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px',
          background:ST.bg, border:`1px solid ${ST.border}`, borderRadius:'var(--radius-lg)', textDecoration:'none' }}>
        <StIcon size={20}/>
        <div>
          <div style={{ fontWeight:'700', fontSize:'14px', color:ST.blue, lineHeight:1.2 }}>steam</div>
          <div style={{ fontSize:'11px', color:ST.faint, marginTop:'2px' }}>@{handle}</div>
        </div>
        <span style={{ marginLeft:'auto', fontSize:'11px', color:ST.faint }}>open →</span>
      </a>
    );
  }

  return (
    <div style={{ background:ST.bg, border:`1px solid ${ST.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>

      {/* ── Brand header — always visible ── */}
      <div style={{ background:ST.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${ST.border}` }}>

        <a href={profileUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <StIcon size={18}/>
          <span style={{ fontWeight:'700', fontSize:'13px', color:ST.blue, letterSpacing:'0.08em', textTransform:'uppercase' }}>steam</span>
        </a>

        {loading && !data && <span style={{ fontSize:'11px', color:ST.faint }}>loading…</span>}
        {error   && <span style={{ fontSize:'11px', color:'#e87c2a' }}>error</span>}

        <div style={{ flex:1 }}/>

        <HeaderButtons btnClass="st-hdr-btn" labelClass="st-hdr-label" accent={ST.blue}
          copied={copied} onCopy={copyLink} copyLabel="copy profile link" copyTitle="Copy profile link"
          href={profileUrl} openLabel="open in steam" openTitle="Open in Steam"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`st-body ${collapsed ? 'closed' : 'open'}`}>

        {/* ── Profile row — status lives here, next to name ── */}
        {data && (
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${ST.div}`, display:'flex', alignItems:'center', gap:'14px' }}>
            {data.avatar?.large
              ? <a href={profileUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                  <img src={data.avatar.large} alt={data.displayName}
                    style={{ width:'52px', height:'52px', display:'block', flexShrink:0,
                      border:`2px solid ${isOnline ? dotColor : ST.faint}` }}/>
                </a>
              : <div style={{ width:'52px', height:'52px', background:'#0e1a26',
                  border:`2px solid ${ST.faint}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <StIcon size={24}/>
                </div>
            }

            <div style={{ flex:1, minWidth:0 }}>
              {/* Name + status on the same line */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px', flexWrap:'wrap' }}>
                <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontWeight:'800', fontSize:'17px', color:ST.white, textDecoration:'none',
                    lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {data.displayName}
                </a>
                {/* Status badge next to name */}
                <span style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:dotColor, flexShrink:0 }}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:dotColor, flexShrink:0,
                    boxShadow: isOnline ? `0 0 6px ${dotColor}99` : 'none' }}></span>
                  {statusLabel}
                </span>
              </div>

              {/* Meta row: level, game count, member since */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center' }}>
                {data.level != null && (
                  <span style={{ fontSize:'10px', background:ST.blue, color:'#0e1a26',
                    fontWeight:'800', padding:'2px 8px', borderRadius:'2px', letterSpacing:'0.05em' }}>
                    LVL {data.level}
                  </span>
                )}
                {data.totalGames != null && (
                  <span style={{ fontSize:'11px', color:ST.muted }}>
                    <span style={{ color:ST.white, fontWeight:'600' }}>{data.totalGames}</span> games
                  </span>
                )}
                {data.memberSince && (
                  <span style={{ fontSize:'11px', color:ST.faint }}>
                    since {new Date(data.memberSince).getFullYear()}
                  </span>
                )}
              </div>
            </div>

            <a href={profileUrl} target="_blank" rel="noopener noreferrer"
              className="st-open-btn"
              style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
                padding:'7px 14px', borderRadius:'3px', border:`1px solid ${ST.blue}`,
                color:ST.blue, fontSize:'12px', fontWeight:'600', textDecoration:'none' }}>
              <StIcon size={13}/>
              <span className="st-open-label">Open in Steam</span>
            </a>
          </div>
        )}

        {/* Currently in-game banner */}
        {data?.currentGame && (() => {
          const cg = typeof data.currentGame === 'string' ? { name: data.currentGame } : data.currentGame;
          const cgHref = cg.appid ? `https://store.steampowered.com/app/${cg.appid}` : null;
          return (
            <div style={{ position:'relative', overflow:'hidden', borderBottom:`1px solid ${ST.div}`, minHeight:'72px' }}>
              {/* library_hero full-bleed background */}
              {cg.images?.hero && (
                <img src={cg.images.hero} alt="" aria-hidden="true"
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', opacity:0.35, display:'block', pointerEvents:'none' }}/>
              )}
              {/* dark gradient overlay so text stays readable */}
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,rgba(14,32,46,0.92) 0%,rgba(27,40,56,0.65) 100%)' }}></div>
              {/* content */}
              <div style={{ position:'relative', padding:'12px 20px', display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:ST.ingame,
                  boxShadow:`0 0 7px ${ST.ingame}99`, flexShrink:0 }}></span>
                {/* header capsule */}
                {cg.images?.header && cgHref && (
                  <a href={cgHref} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                    <img src={cg.images.header} alt={cg.name}
                      style={{ height:'46px', width:'auto', maxWidth:'108px', borderRadius:'3px', display:'block', objectFit:'cover' }}/>
                  </a>
                )}
                <div>
                  <div style={{ fontSize:'10px', color:'#90ba3c', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'3px' }}>now playing</div>
                  <div style={{ fontWeight:'700', fontSize:'15px', color:ST.ingame, textShadow:'0 1px 4px rgba(0,0,0,0.6)' }}>{cg.name}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Sections stacked — no tabs ── */}
        {data && (
          <div style={{ padding:'16px 16px 20px', display:'flex', flexDirection:'column', gap:'24px' }}>

            {data.recentActivity?.length > 0 && (
              <div>
                <StSectionLabel>recent activity</StSectionLabel>
                <StRecentSection items={data.recentActivity}/>
              </div>
            )}

            {data.favoriteGame && (
              <div>
                <StSectionLabel>favorite game</StSectionLabel>
                <StFavoriteSection game={data.favoriteGame}/>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

