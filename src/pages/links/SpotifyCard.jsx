// SpotifyCard.jsx — Spotify card, API endpoint only
// Fields used: status.{is_playing,item,progress_ms,context,contextPlaylist}
//              profile, topTracks, topArtists, recent, playlists
import { ensureScStyles, useCollapsed, useCopy, usePolledJSON, HeaderButtons } from './shared.jsx';

const { useState, useEffect } = React;

// ── One-time CSS ──────────────────────────────────────────────────────────────
let _spStyleDone = false;
function ensureSpStyles() {
  if (_spStyleDone) return;
  _spStyleDone = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes sp-eq-a{0%,100%{height:5px}50%{height:12px}}
    @keyframes sp-eq-b{0%,100%{height:10px}33%{height:4px}66%{height:9px}}
    @keyframes sp-eq-c{0%,100%{height:7px}50%{height:11px}}
    @keyframes sp-eq-d{0%,100%{height:3px}50%{height:9px}}
    .sp-artist-link:hover{color:#fff !important;}
    .sp-track-row{transition:background 0.1s;}
    .sp-track-row:hover{background:rgba(255,255,255,0.05);border-radius:5px;}
    .sp-tab-btn:hover{color:#b3b3b3 !important;}
    .sp-artist-cell img{transition:transform 0.15s;}
    .sp-artist-cell:hover img{transform:scale(1.06);}
    .sp-artist-cell:hover .sp-artist-name{color:#fff !important;}
    .sp-pl-cell:hover .sp-pl-name{color:#fff !important;}
    .sp-pl-cell img{transition:transform 0.15s;}
    .sp-pl-cell:hover img{transform:scale(1.04);}
    .sp-ctx-pl:hover{background:rgba(255,255,255,0.1) !important;}
    .sp-tabs-bar::-webkit-scrollbar{display:none;}
    .sp-tabs-bar{scrollbar-width:none;-ms-overflow-style:none;}
    .sp-open-btn{transition:background 0.15s,color 0.15s,border-color 0.15s;}
    .sp-open-btn:hover{background:rgba(29,185,84,0.18) !important;color:#fff !important;border-color:#1DB954 !important;}
    @media(max-width:540px){
      .sp-now-track-name{font-size:13px !important;}
      .sp-tab-btn{padding:8px 6px !important;font-size:10px !important;letter-spacing:0.04em !important;}
      .sp-profile-section{padding:12px 14px !important;align-items:center !important;}
      .sp-nowplaying-pad{padding:14px !important;}
      .sp-open-label{display:none;}
    }
  `;
  document.head.appendChild(el);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function spFmtMs(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Palette ───────────────────────────────────────────────────────────────────
const SP = {
  bg:     'linear-gradient(155deg,#0f0f0f 0%,#181818 55%,#121212 100%)',
  bgHead: 'rgba(0,0,0,0.6)',
  border: '#282828',
  div:    'rgba(255,255,255,0.06)',
  green:  '#1DB954',
  white:  '#fff',
  muted:  '#b3b3b3',
  faint:  '#535353',
  surf:   'rgba(255,255,255,0.07)',
};

const SP_PATH = 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z';
function SpIcon({ size }) {
  return <svg viewBox="0 0 24 24" fill={SP.green} width={size||16} height={size||16} style={{ flexShrink:0,display:'block' }}><path d={SP_PATH}/></svg>;
}

// ── Animated EQ bars ──────────────────────────────────────────────────────────
function EqBars({ playing }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'flex-end', gap:'2px', height:'12px' }}>
      {['sp-eq-a','sp-eq-b','sp-eq-c','sp-eq-d'].map((a,i) => (
        <span key={i} style={{
          display:'block', width:'3px', height:[5,10,7,3][i]+'px',
          background:SP.green, borderRadius:'1px', transformOrigin:'bottom',
          animation: playing ? `${a} ${0.7+i*0.09}s ease-in-out infinite` : 'none',
          animationDelay:`${i*0.1}s`,
        }}/>
      ))}
    </span>
  );
}

// ── Artist links ──────────────────────────────────────────────────────────────
function ArtistLinks({ artists, color, size }) {
  if (!artists?.length) return null;
  const c = color || SP.muted;
  return (
    <span style={{ fontSize:size||'13px' }}>
      {artists.map((a,i) => (
        <span key={a.id||i}>
          <a href={a.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
            className="sp-artist-link" style={{ color:c, textDecoration:'none' }}>
            {a.name}
          </a>
          {i < artists.length-1 && <span style={{ color:SP.faint }}>, </span>}
        </span>
      ))}
    </span>
  );
}

// ── Now Playing section ───────────────────────────────────────────────────────
function NowPlayingSection({ item, progressMs, context, contextPlaylist }) {
  if (!item) return null;
  const duration = item.duration_ms || 0;
  const pct = duration > 0 ? Math.min(100, (progressMs / duration) * 100) : 0;

  // contextPlaylist: enriched playlist from API (status.contextPlaylist)
  // fallback to context.external_urls for a basic link
  const playlist = contextPlaylist || null;
  const playlistUrl = playlist?.url
    || (context?.type === 'playlist' ? context?.external_urls?.spotify : null);
  const playlistImg = playlist?.images?.[0]?.url || playlist?.images?.[1]?.url;
  const playlistName = playlist?.name;
  const playlistTotal = playlist?.totalTracks;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'10px', color:SP.faint, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'14px' }}>
        <EqBars playing={true}/>
        now playing
      </div>

      <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
        {item.album?.images?.[0]?.url && (
          <a href={item.album?.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
            <img src={item.album.images[0].url} alt=""
              style={{ width:'96px', height:'96px', borderRadius:'6px', display:'block', boxShadow:'0 8px 24px rgba(0,0,0,0.7)' }}/>
          </a>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <a href={item.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
            className="sp-now-track-name"
            style={{ display:'block', fontWeight:'700', fontSize:'16px', color:SP.white, marginBottom:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none' }}>
            {item.name}
          </a>
          <div style={{ marginBottom:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            <ArtistLinks artists={item.artists}/>
          </div>
          <div style={{ fontSize:'11px', color:SP.faint, marginBottom:'14px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {item.album?.name}
          </div>
          {duration > 0 && (
            <>
              <div style={{ background:SP.surf, borderRadius:'2px', height:'3px', marginBottom:'5px' }}>
                <div style={{ background:SP.green, borderRadius:'2px', height:'3px', width:`${pct}%`, transition:'width 1s linear' }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:SP.faint, fontVariantNumeric:'tabular-nums' }}>
                <span>{spFmtMs(progressMs)}</span>
                <span>{spFmtMs(duration)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Playing from playlist — prominent card below track */}
      {playlistUrl && (
        <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="sp-ctx-pl"
          style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'16px', padding:'10px 12px',
            background:'rgba(255,255,255,0.05)', borderRadius:'8px', border:`1px solid ${SP.border}`,
            textDecoration:'none', transition:'background 0.12s' }}>
          {playlistImg
            ? <img src={playlistImg} alt="" style={{ width:'44px', height:'44px', borderRadius:'4px', flexShrink:0, objectFit:'cover' }}/>
            : <div style={{ width:'44px', height:'44px', borderRadius:'4px', background:SP.surf, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill={SP.faint} width="20" height="20"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
              </div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'10px', color:SP.faint, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'3px' }}>playing from playlist</div>
            <div style={{ fontSize:'13px', fontWeight:'600', color:SP.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {playlistName || 'a playlist'}
            </div>
            {playlistTotal != null && (
              <div style={{ fontSize:'11px', color:SP.faint, marginTop:'2px' }}>{playlistTotal} tracks</div>
            )}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={SP.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ flexShrink:0 }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      )}
    </div>
  );
}

// ── Tab: Recently Played ──────────────────────────────────────────────────────
function RecentSection({ items }) {
  if (!items?.length) return <p style={{ color:SP.faint, fontSize:'13px', margin:0 }}>nothing here yet</p>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
      {items.slice(0,8).map((item,i) => {
        const t = item.track;
        if (!t) return null;
        return (
          <div key={i} className="sp-track-row" style={{ display:'flex', gap:'10px', alignItems:'center', padding:'6px 8px' }}>
            {t.album?.images?.[2]?.url && <img src={t.album.images[2].url} alt="" style={{ width:'36px', height:'36px', borderRadius:'3px', flexShrink:0 }}/>}
            <div style={{ flex:1, minWidth:0 }}>
              <a href={t.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
                style={{ display:'block', fontSize:'13px', fontWeight:'500', color:SP.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none' }}>
                {t.name}
              </a>
              <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                <ArtistLinks artists={t.artists} size="11px"/>
              </div>
            </div>
            <span style={{ fontSize:'10px', color:SP.faint, flexShrink:0, whiteSpace:'nowrap' }}>{timeAgo(item.played_at)}</span>
            <span style={{ fontSize:'11px', color:SP.faint, flexShrink:0, fontVariantNumeric:'tabular-nums', minWidth:'34px', textAlign:'right' }}>{spFmtMs(t.duration_ms)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Playlists ────────────────────────────────────────────────────────────
function PlaylistsSection({ items }) {
  if (!items?.length) return <p style={{ color:SP.faint, fontSize:'13px', margin:0 }}>no playlists</p>;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:'12px' }}>
      {items.map(pl => (
        <a key={pl.id} href={pl.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
          className="sp-pl-cell" style={{ display:'flex', flexDirection:'column', gap:'7px', textDecoration:'none' }}>
          {pl.images?.[0]?.url
            ? <img src={pl.images[0].url} alt={pl.name} style={{ width:'100%', aspectRatio:'1', borderRadius:'5px', display:'block', objectFit:'cover' }}/>
            : <div style={{ width:'100%', aspectRatio:'1', borderRadius:'5px', background:SP.surf, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill={SP.faint} width="28" height="28"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>
              </div>
          }
          <div>
            <div className="sp-pl-name" style={{ fontSize:'11px', fontWeight:'500', color:SP.muted, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'color 0.12s' }}>
              {pl.name}
            </div>
            {pl.tracks?.total != null && (
              <div style={{ fontSize:'10px', color:SP.faint, marginTop:'2px' }}>{pl.tracks.total} tracks</div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Tab: Top Tracks ───────────────────────────────────────────────────────────
function TopTracksSection({ items }) {
  if (!items?.length) return <p style={{ color:SP.faint, fontSize:'13px', margin:0 }}>no data yet</p>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
      {items.slice(0,8).map((t,i) => (
        <div key={t.id} className="sp-track-row" style={{ display:'flex', gap:'10px', alignItems:'center', padding:'6px 8px' }}>
          <span style={{ width:'18px', textAlign:'right', fontSize:'12px', color:SP.faint, flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{i+1}</span>
          {t.album?.images?.[2]?.url && <img src={t.album.images[2].url} alt="" style={{ width:'36px', height:'36px', borderRadius:'3px', flexShrink:0 }}/>}
          <div style={{ flex:1, minWidth:0 }}>
            <a href={t.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
              style={{ display:'block', fontSize:'13px', fontWeight:'500', color:SP.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none' }}>
              {t.name}
            </a>
            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              <ArtistLinks artists={t.artists} size="11px"/>
            </div>
          </div>
          <span style={{ fontSize:'11px', color:SP.faint, flexShrink:0, fontVariantNumeric:'tabular-nums', minWidth:'34px', textAlign:'right' }}>{spFmtMs(t.duration_ms)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Top Artists ──────────────────────────────────────────────────────────
function TopArtistsSection({ items }) {
  if (!items?.length) return <p style={{ color:SP.faint, fontSize:'13px', margin:0 }}>no data yet</p>;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(76px,1fr))', gap:'14px' }}>
      {items.slice(0,10).map(a => (
        <a key={a.id} href={a.external_urls?.spotify||'#'} target="_blank" rel="noopener noreferrer"
          className="sp-artist-cell" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'7px', textDecoration:'none' }}>
          {a.images?.[1]?.url
            ? <img src={a.images[1].url} alt={a.name} style={{ width:'60px', height:'60px', borderRadius:'50%', display:'block', objectFit:'cover' }}/>
            : <div style={{ width:'60px', height:'60px', borderRadius:'50%', background:SP.surf, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill={SP.faint} width="26" height="26"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </div>
          }
          <div style={{ textAlign:'center', width:'100%' }}>
            <div className="sp-artist-name" style={{ fontSize:'11px', color:SP.muted, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', transition:'color 0.12s' }}>
              {a.name}
            </div>
            {a.genres?.[0] && <div style={{ fontSize:'9px', color:SP.faint, marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.genres[0]}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Simple card (userId only) ─────────────────────────────────────────────────
export function SpotifySimpleCard({ userId }) {
  const href = `https://open.spotify.com/user/${userId}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 18px', background:SP.bg, border:`1px solid ${SP.border}`, borderRadius:'var(--radius-lg)', textDecoration:'none' }}>
      <SpIcon size={20}/>
      <div>
        <div style={{ fontWeight:'700', fontSize:'14px', color:SP.green, lineHeight:1.2 }}>spotify</div>
        <div style={{ fontSize:'11px', color:SP.faint, marginTop:'2px' }}>@{userId}</div>
      </div>
      <span style={{ marginLeft:'auto', fontSize:'11px', color:SP.faint }}>open →</span>
    </a>
  );
}

// ── Main SpotifyCard ──────────────────────────────────────────────────────────
export function SpotifyCard({ userId, apiEndpoint }) {
  ensureScStyles();
  ensureSpStyles();

  const [data,       setData]       = useState(null);
  const [progressMs, setProgressMs] = useState(0);
  const [tab,        setTab]        = useState('recent');
  const [collapsed,  toggleCollapse] = useCollapsed('sp_card_collapsed');

  const profile      = data?.profile;
  const status       = data?.status;
  const isPlaying    = !!(status?.is_playing && status?.item);
  const currentItem  = status?.item || null;
  const ctxPlaylist  = status?.contextPlaylist || null;
  const profileHref  = profile?.external_urls?.spotify
    || (userId ? `https://open.spotify.com/user/${userId}` : 'https://open.spotify.com');

  // ── Hooks before early return ─────────────────────────────────────────────

  const [copied, copyLink] = useCopy(profileHref);

  const { loading, error } = usePolledJSON(apiEndpoint, 30000, (d, initial) => {
    if (initial) {
      setData(d);
      const pm = d.status?.progress_ms;
      if (pm != null && pm > 0) setProgressMs(pm);
      return;
    }
    setData(prev => {
      const wasPlaying = !!prev?.status?.is_playing;
      const nowPlaying = !!d.status?.is_playing;
      if ((!wasPlaying && nowPlaying) || (nowPlaying && prev?.status?.item?.id !== d.status?.item?.id)) {
        setProgressMs(d.status?.progress_ms || 0);
      }
      return d;
    });
  });

  useEffect(() => {
    if (!isPlaying) return;
    const duration = currentItem?.duration_ms || 0;
    const t = setInterval(() => setProgressMs(p => duration > 0 ? Math.min(p + 1000, duration) : p + 1000), 1000);
    return () => clearInterval(t);
  }, [isPlaying, currentItem?.id]);

  const playlistItems = data?.playlists || [];

  const TABS = [
    { id:'recent',    label:'recent'    },
    { id:'playlists', label:'playlists' },
    { id:'tracks',    label:'tracks'    },
    { id:'artists',   label:'artists'   },
  ];

  return (
    <div style={{ background:SP.bg, border:`1px solid ${SP.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>

      {/* ── Brand header — always visible ── */}
      <div style={{ background:SP.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px', borderBottom: collapsed ? 'none' : `1px solid ${SP.border}` }}>

        {/* Spotify icon + SPOTIFY — clickable */}
        <a href={profileHref} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <SpIcon size={18}/>
          <span style={{ fontWeight:'700', fontSize:'13px', color:SP.green, letterSpacing:'0.08em', textTransform:'uppercase' }}>spotify</span>
        </a>

        {loading && !profile && <span style={{ fontSize:'11px', color:SP.faint }}>loading…</span>}
        {error && <span style={{ fontSize:'11px', color:'#e87c2a', flexShrink:0 }}>error</span>}

        <div style={{ flex:1 }}/>

        <HeaderButtons btnClass="sc-hdr-btn sp-hdr-btn" labelClass="sc-hdr-label" accent={SP.green}
          copied={copied} onCopy={copyLink} copyLabel="copy profile link" copyTitle="Copy profile link"
          href={profileHref} openLabel="open in spotify" openTitle="Open in Spotify"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>

        {/* Profile */}
        {profile && (
          <div className="sp-profile-section" style={{ padding:'16px 20px', borderBottom:`1px solid ${SP.div}`, display:'flex', alignItems:'center', gap:'14px' }}>
            {profile.images?.[0]?.url
              ? <a href={profileHref} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                  <img src={profile.images[0].url} alt={profile.display_name}
                    style={{ width:'48px', height:'48px', borderRadius:'50%', display:'block', border:`2px solid ${SP.border}`, objectFit:'cover' }}/>
                </a>
              : <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:SP.surf, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><SpIcon size={22}/></div>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <a href={profileHref} target="_blank" rel="noopener noreferrer"
                style={{ display:'block', fontWeight:'800', fontSize:'17px', color:SP.white, textDecoration:'none', lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {profile.display_name}
              </a>
              {profile.followers?.total != null && (
                <div style={{ fontSize:'12px', color:SP.muted, marginTop:'4px' }}>
                  <span style={{ color:SP.white, fontWeight:'600' }}>{profile.followers.total.toLocaleString()}</span> followers
                </div>
              )}
            </div>
            <a href={profileHref} target="_blank" rel="noopener noreferrer"
              className="sp-open-btn"
              style={{ display:'inline-flex', alignItems:'center', gap:'5px', flexShrink:0,
                padding:'7px 14px', borderRadius:'20px', border:`1px solid ${SP.green}`,
                color:SP.green, fontSize:'12px', fontWeight:'600', textDecoration:'none' }}>
              <SpIcon size={13}/>
              <span className="sp-open-label">Open in Spotify</span>
            </a>
          </div>
        )}

        {/* Now Playing */}
        {isPlaying && currentItem && (
          <div className="sp-nowplaying-pad" style={{ padding:'20px', borderBottom:`1px solid ${SP.div}` }}>
            <NowPlayingSection
              item={currentItem}
              progressMs={progressMs}
              context={status?.context}
              contextPlaylist={ctxPlaylist}
            />
          </div>
        )}

        {/* Not playing */}
        {data && !isPlaying && (
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${SP.div}`, display:'flex', alignItems:'center', gap:'8px' }}>
            <EqBars playing={false}/>
            <span style={{ fontSize:'12px', color:SP.faint }}>not playing anything right now</span>
          </div>
        )}

        {/* Tabs */}
        {data && (
          <div>
            <div className="sp-tabs-bar" style={{ display:'flex', borderBottom:`1px solid ${SP.div}`, padding:'0 12px', overflowX:'auto' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className="sp-tab-btn"
                  style={{
                    padding:'10px 10px', fontSize:'11px', fontWeight:tab===t.id?'700':'400',
                    color:tab===t.id?SP.white:SP.faint, background:'none', border:'none',
                    cursor:'pointer', borderBottom:`2px solid ${tab===t.id?SP.green:'transparent'}`,
                    textTransform:'uppercase', letterSpacing:'0.07em',
                    transition:'color 0.12s', marginBottom:'-1px', whiteSpace:'nowrap', flexShrink:0,
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding:'14px 12px 18px' }}>
              {tab==='recent'    && <RecentSection     items={data.recent?.items}/>}
              {tab==='playlists' && <PlaylistsSection  items={playlistItems}/>}
              {tab==='tracks'    && <TopTracksSection  items={data.topTracks?.items}/>}
              {tab==='artists'   && <TopArtistsSection items={data.topArtists?.items}/>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

