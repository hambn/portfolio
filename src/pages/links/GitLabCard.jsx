import { ensureScStyles, ContribGraph, useCollapsed, useCopy, usePolledJSON, HeaderButtons } from './shared.jsx';
const { useState } = React;

const GL = {
  bg:     '#1f1f23',
  bgHead: '#28272d',
  border: '#3a3a42',
  div:    '#2e2d34',
  orange: '#FC6D26',
  orangeH:'#FCA326',
  red:    '#E24329',
  text:   '#ececef',
  muted:  '#a1a1aa',
  faint:  '#6f6f78',
};
const GL_LEVELS = ['#2e2d34', '#0e4429', '#006d32', '#26a641', '#39d353'];
const GL_ICON = 'M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.423-.73-.423-.867 0L16.418 9.45H7.582L4.919 1.263C4.783.84 4.185.84 4.05 1.263L1.386 9.452.044 13.587c-.121.375.014.789.331 1.023L12 23.054l11.625-8.443c.318-.235.453-.647.33-1.024';

export function GitLabCard({ username, url }) {
  ensureScStyles();
  const [profile,   setProfile]   = useState(null);
  const [collapsed, toggleCollapse] = useCollapsed('gl_card_collapsed');

  const href = url || `https://gitlab.com/${username}`;
  const [copied, copyLink] = useCopy(href);
  const { loading } = usePolledJSON(username ? `https://gitlab.com/api/v4/users?username=${username}` : null, 0,
    (d) => setProfile(Array.isArray(d) ? d[0] : null));

  return (
    <div style={{ background:GL.bg, border:`1px solid ${GL.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ background:GL.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${GL.border}` }}>
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill={GL.orange} width={18} height={18} style={{ flexShrink:0, display:'block' }}><path d={GL_ICON}/></svg>
          <span style={{ fontWeight:'700', fontSize:'13px', color:GL.text, letterSpacing:'0.08em', textTransform:'uppercase' }}>gitlab</span>
        </a>
        {loading && !profile && <span style={{ fontSize:'11px', color:GL.faint }}>loading…</span>}
        <div style={{ flex:1 }}/>
        <HeaderButtons btnClass="sc-hdr-btn gl-hdr-btn" labelClass="sc-hdr-label" accent={GL.orangeH}
          copied={copied} onCopy={copyLink}
          href={href} openTitle="Open on GitLab"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>
      {/* Body */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${GL.div}`, display:'flex', alignItems:'center', gap:'14px' }}>
          {profile?.avatar_url
            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0 }}>
                <img src={profile.avatar_url} alt={username}
                  style={{ width:'52px', height:'52px', borderRadius:'50%', display:'block', border:`2px solid ${GL.border}`, objectFit:'cover' }}/>
              </a>
            : <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'#26252b',
                border:`2px solid ${GL.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill={GL.orange} width={26} height={26}><path d={GL_ICON}/></svg>
              </div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <a href={href} target="_blank" rel="noopener noreferrer"
              style={{ display:'block', fontWeight:'800', fontSize:'17px', color:GL.text, textDecoration:'none',
                lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'4px' }}>
              {profile?.name || username}
            </a>
            <div style={{ fontSize:'13px', color:GL.muted, marginBottom:'3px' }}>@{profile?.username || username}</div>
            {profile?.bio && <div style={{ fontSize:'12px', color:GL.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.bio}</div>}
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
              padding:'7px 14px', borderRadius:'6px', border:`1px solid rgba(252,109,38,0.4)`,
              background:GL.orange, color:'#1f1f23', fontSize:'12px', fontWeight:'700', textDecoration:'none',
              transition:'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background=GL.orangeH; }}
            onMouseLeave={e => { e.currentTarget.style.background=GL.orange; }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width={13} height={13} style={{ flexShrink:0 }}><path d={GL_ICON}/></svg>
            <span>Profile</span>
          </a>
        </div>
        <ContribGraph username={username} source="gitlab" levels={GL_LEVELS} theme={{ div: GL.div, faint: GL.faint, muted: GL.muted }}/>
      </div>
    </div>
  );
}
