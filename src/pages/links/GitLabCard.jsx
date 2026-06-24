import { ensureScStyles, ContribGraph } from './shared.jsx';
const { useState, useEffect } = React;

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
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('gl_card_collapsed') === '1'; } catch { return false; }
  });

  const href = url || `https://gitlab.com/${username}`;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetch(`https://gitlab.com/api/v4/users?username=${username}`)
      .then(r => r.json())
      .then(d => { setProfile(Array.isArray(d) ? d[0] : null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [username]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('gl_card_collapsed', next ? '1' : '0'); } catch {}
  };
  const copyLink = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const fb = () => { const el = document.createElement('textarea'); el.value = href; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); done(); };
    try { navigator.clipboard.writeText(href).then(done).catch(fb); } catch { fb(); }
  };

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
        <button onClick={copyLink} className="sc-hdr-btn gl-hdr-btn" title="Copy link">
          {copied
            ? <svg viewBox="0 0 24 24" fill="none" stroke={GL.orangeH} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
          <span className="sc-hdr-label" style={{ color: copied ? GL.orangeH : 'inherit' }}>{copied ? 'copied!' : 'copy link'}</span>
        </button>
        <button className="sc-hdr-btn gl-hdr-btn" title="Open on GitLab" onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="sc-hdr-label">open</span>
        </button>
        <button onClick={toggleCollapse} className="sc-hdr-btn gl-hdr-btn" title={collapsed ? 'Expand' : 'Collapse'} style={{ padding:'4px 5px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.25s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
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
        <div style={{ borderTop:`1px solid ${GL.div}`, height:'10px' }}></div>
      </div>
    </div>
  );
}
