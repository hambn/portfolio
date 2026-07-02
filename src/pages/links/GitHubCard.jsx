import { ensureScStyles, ContribGraph, useCollapsed, useCopy, usePolledJSON, HeaderButtons } from './shared.jsx';
const { useState } = React;

const GH = {
  bg:     '#0d1117',
  bgHead: '#161b22',
  border: '#30363d',
  div:    '#21262d',
  blue:   '#58a6ff',
  green:  '#2ea043',
  greenH: '#3fb950',
  text:   '#e6edf3',
  muted:  '#8b949e',
  faint:  '#6e7681',
};
const GH_LEVELS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const GH_ICON = 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

export function GitHubCard({ username, url }) {
  ensureScStyles();
  const [profile,   setProfile]   = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('gh_card_collapsed');

  const href = url || `https://github.com/${username}`;
  const [copied, copyLink] = useCopy(href);
  const { loading } = usePolledJSON(username ? `https://api.github.com/users/${username}` : null, 0, (d) => setProfile(d));

  return (
    <div style={{ background:GH.bg, border:`1px solid ${GH.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:GH.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${GH.border}` }}>
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill={GH.text} width={18} height={18} style={{ flexShrink:0, display:'block' }}><path d={GH_ICON}/></svg>
          <span style={{ fontWeight:'700', fontSize:'13px', color:GH.text, letterSpacing:'0.08em', textTransform:'uppercase' }}>github</span>
        </a>
        {loading && !profile && <span style={{ fontSize:'11px', color:GH.faint }}>loading…</span>}
        <div style={{ flex:1 }}/>
        <HeaderButtons btnClass="sc-hdr-btn gh-hdr-btn" labelClass="sc-hdr-label" accent={GH.blue}
          copied={copied} onCopy={copyLink}
          href={href} openTitle="Open on GitHub"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>
      {/* Body */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${GH.div}`, display:'flex', alignItems:'center', gap:'14px' }}>
          {profile?.avatar_url
            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                <img src={profile.avatar_url} alt={username}
                  style={{ width:'52px', height:'52px', borderRadius:'50%', display:'block', border:`2px solid ${GH.border}`, objectFit:'cover' }}/>
              </a>
            : <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'#21262d',
                border:`2px solid ${GH.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill={GH.muted} width={28} height={28}><path d={GH_ICON}/></svg>
              </div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ display:'block', fontWeight:'800', fontSize:'17px', color:GH.text, textDecoration:'none',
                lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'4px' }}>
              {profile?.name || username}
            </a>
            {profile?.name && <div style={{ fontSize:'13px', color:GH.muted, marginBottom:'3px' }}>@{username}</div>}
            {profile?.bio && <div style={{ fontSize:'12px', color:GH.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.bio}</div>}
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
              padding:'7px 14px', borderRadius:'6px', border:`1px solid rgba(240,246,252,0.1)`,
              background:GH.green, color:'#fff', fontSize:'12px', fontWeight:'600', textDecoration:'none',
              transition:'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background=GH.greenH; }}
            onMouseLeave={e => { e.currentTarget.style.background=GH.green; }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width={13} height={13} style={{ flexShrink:0 }}><path d={GH_ICON}/></svg>
            <span>Follow</span>
          </a>
        </div>
        {profile && (
          <div style={{ padding:'14px 20px', display:'flex', gap:'24px', flexWrap:'wrap', alignItems:'center' }}>
            {[['repos', profile.public_repos], ['followers', profile.followers], ['following', profile.following]].map(([k, v]) => (
              <a key={k} href={`${href}?tab=${k}`} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration:'none', display:'flex', flexDirection:'column', gap:'2px' }}
                onMouseEnter={e => e.currentTarget.querySelector('.gh-sv').style.color = GH.blue}
                onMouseLeave={e => e.currentTarget.querySelector('.gh-sv').style.color = GH.text}>
                <span className="gh-sv" style={{ fontWeight:'700', fontSize:'17px', color:GH.text, transition:'color 0.12s' }}>{(v ?? 0).toLocaleString()}</span>
                <span style={{ fontSize:'11px', color:GH.faint, textTransform:'uppercase', letterSpacing:'0.07em' }}>{k}</span>
              </a>
            ))}
          </div>
        )}
        {profile && profile.login && <ContribGraph username={username} source="github" levels={GH_LEVELS} theme={{ div: GH.div, faint: GH.faint, muted: GH.muted }}/>}
      </div>
    </div>
  );
}
