// DiscordCard.jsx — Discord presence card, themed like Spotify/Steam/LinkedIn
// Uses https://api.portfolio.hgh.dev/discord + Lanyard WebSocket (passed as lanyardData)
import { ensureScStyles, useCollapsed, useCopy, usePolledJSON, HeaderButtons } from './shared.jsx';

const { useState } = React;

let _dcStyleDone = false;
function ensureDcStyles() {
  if (_dcStyleDone) return;
  _dcStyleDone = true;
  const el = document.createElement('style');
  el.textContent = `
    .dc-open-btn{transition:background 0.15s,color 0.15s,border-color 0.15s;}
    .dc-open-btn:hover{background:rgba(88,101,242,0.2) !important;color:#fff !important;border-color:#5865F2 !important;}
  `;
  document.head.appendChild(el);
}

const DC = {
  bg:       'linear-gradient(155deg,#111214 0%,#1a1b1e 55%,#111214 100%)',
  bgHead:   'rgba(0,0,0,0.45)',
  border:   '#2b2d31',
  div:      'rgba(255,255,255,0.06)',
  blurple:  '#5865F2',
  blurpleLt:'#949cf7',
  text:     '#dbdee1',
  muted:    '#80848e',
  faint:    '#4e5058',
  STATUS_COLOR: { online:'#23a55a', idle:'#f0b232', dnd:'#f23f43', offline:'#80848e' },
  STATUS_LABEL: { online:'online', idle:'idle', dnd:'do not disturb', offline:'offline' },
};

const DC_ICON = 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.113 18.1.138 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.027c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.948-2.157 2.157-2.157 1.211 0 2.157.964 2.157 2.157 0 1.191-.946 2.156-2.157 2.156zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.948-2.157 2.157-2.157 1.211 0 2.157.964 2.157 2.157 0 1.191-.946 2.156-2.157 2.156z';

function DcIcon({ size, color }) {
  return (
    <svg viewBox="0 0 24 24" fill={color || DC.blurple} width={size||16} height={size||16} style={{ flexShrink:0, display:'block' }}>
      <path d={DC_ICON}/>
    </svg>
  );
}

export function DiscordCard({ userId, lanyardData, apiEndpoint }) {
  ensureScStyles();
  ensureDcStyles();

  const [apiData,   setApiData]   = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('dc_card_collapsed');

  // Prefer live API data, fall back to Lanyard WebSocket. The two shapes
  // differ: the flat API gives a full avatar URL + top-level fields, Lanyard
  // nests under discord_user and ships an avatar hash. Map both to one set.
  const raw    = apiData || lanyardData;
  const flat   = !!raw?.username && !raw?.discord_user;
  const status = (flat ? raw.status : raw?.discord_status) || 'offline';
  const user   = flat ? raw : raw?.discord_user;
  const displayName = (flat ? raw.displayName || raw.username : user?.global_name || user?.username) || null;
  const handle      = (flat ? raw.username : user?.username) || null;
  const avatarUrl = flat
    ? raw.avatar || null
    : (user?.avatar && user?.id)
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : null;

  const activities   = raw?.activities || [];
  const customStatus = activities.find(a => a.type === 4);
  // Everything except the custom-status entry is a real activity to show.
  const liveActivities = activities.filter(a => a.type !== 4);
  const ACT_LABEL = { 0: 'playing', 1: 'streaming', 2: 'listening to', 3: 'watching', 5: 'competing in' };

  const profileUrl = `https://discord.com/users/${userId}`;
  const dotColor   = DC.STATUS_COLOR[status] || DC.STATUS_COLOR.offline;

  const [copied, copyLink] = useCopy(profileUrl);
  const { loading } = usePolledJSON(apiEndpoint, 30000, (d) => {
    if (d?.username) setApiData(d); // flat api.portfolio.hgh.dev shape only
  });

  // Game activity image URL helper
  const getGameImgSrc = (activity) => {
    if (!activity?.assets?.large_image) return null;
    const img = activity.assets.large_image;
    if (img.startsWith('spotify:')) return `https://i.scdn.co/image/${img.slice(8)}`;
    if (img.startsWith('mp:')) return `https://media.discordapp.net/${img.slice(3)}`;
    return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${img}.png`;
  };

  return (
    <div style={{ background:DC.bg, border:`1px solid ${DC.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>

      {/* ── Brand header — always visible ── */}
      <div style={{ background:DC.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${DC.border}` }}>

        <a href={profileUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <DcIcon size={18}/>
          <span style={{ fontWeight:'700', fontSize:'13px', color:DC.blurpleLt, letterSpacing:'0.08em', textTransform:'uppercase' }}>discord</span>
        </a>

        {loading && !raw && <span style={{ fontSize:'11px', color:DC.faint }}>loading…</span>}

        <div style={{ flex:1 }}/>

        <HeaderButtons btnClass="sc-hdr-btn dc-hdr-btn" labelClass="sc-hdr-label" accent={DC.blurpleLt}
          copied={copied} onCopy={copyLink} copyTitle="Copy profile link"
          href={profileUrl} openLabel="open profile" openTitle="Open Discord profile"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>

        {/* Profile row */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${DC.div}`,
          display:'flex', alignItems:'center', gap:'14px' }}>

          {/* Avatar with status dot */}
          <div style={{ position:'relative', flexShrink:0 }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName || handle || 'Discord'}
                  style={{ width:'52px', height:'52px', borderRadius:'50%', display:'block',
                    border:`2px solid ${DC.border}`, objectFit:'cover' }}/>
              : <div style={{ width:'52px', height:'52px', borderRadius:'50%',
                  background:'linear-gradient(135deg,#5865F2,#7289da)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <DcIcon size={26} color="white"/>
                </div>
            }
            {/* Status dot */}
            <div style={{ position:'absolute', bottom:'-1px', right:'-1px',
              background:'#1a1b1e', borderRadius:'50%', padding:'2px',
              border:'2px solid #111214', lineHeight:0 }}>
              <span style={{ width:'10px', height:'10px', borderRadius:'50%',
                background:dotColor, display:'block',
                boxShadow: status === 'online' ? `0 0 5px ${dotColor}` : 'none' }}></span>
            </div>
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            {displayName
              ? <div style={{ fontWeight:'800', fontSize:'17px', color:DC.text, lineHeight:1,
                  marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {displayName}
                </div>
              : <div style={{ fontWeight:'800', fontSize:'17px', color:DC.faint, lineHeight:1, marginBottom:'2px' }}>—</div>
            }
            {handle && (
              <div style={{ fontSize:'12px', color:DC.faint, marginBottom: customStatus?.state ? '4px' : '0' }}>@{handle}</div>
            )}
            {customStatus?.state && (
              <div style={{ fontSize:'12px', color:DC.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {customStatus.emoji?.name && <span style={{ marginRight:'5px' }}>{customStatus.emoji.name}</span>}
                {customStatus.state}
              </div>
            )}
          </div>

          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="dc-open-btn"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
              padding:'7px 14px', borderRadius:'4px', border:`1px solid ${DC.blurple}`,
              color:DC.blurpleLt, fontSize:'12px', fontWeight:'600', textDecoration:'none' }}>
            <DcIcon size={13}/>
            <span>Open</span>
          </a>
        </div>

        {/* Live activities — listening, playing, watching… (custom status excluded) */}
        {liveActivities.map((act, i) => (
          <div key={act.id || i} style={{ padding:'12px 20px', borderBottom:`1px solid ${DC.div}`,
            display:'flex', alignItems:'center', gap:'12px',
            background:'rgba(88,101,242,0.06)' }}>
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:DC.blurple,
              boxShadow:`0 0 7px ${DC.blurple}99`, flexShrink:0 }}></span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'10px', color:DC.faint, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'2px' }}>
                {ACT_LABEL[act.type] || 'activity'}
              </div>
              <div style={{ fontWeight:'700', fontSize:'14px', color:DC.blurpleLt,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {act.details || act.name}
              </div>
              {act.state && (
                <div style={{ fontSize:'11px', color:DC.muted, marginTop:'2px',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {act.state}
                </div>
              )}
              {act.details && act.name && (
                <div style={{ fontSize:'11px', color:DC.faint, marginTop:'1px',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {act.name}
                </div>
              )}
            </div>
            {getGameImgSrc(act) && (
              <img
                src={getGameImgSrc(act)}
                alt={act.assets?.large_text || ''}
                style={{ width:'44px', height:'44px', borderRadius:'6px', flexShrink:0, objectFit:'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
          </div>
        ))}

      </div>
    </div>
  );
}

