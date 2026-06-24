import { ensureScStyles } from './shared.jsx';
const { useState } = React;

const X_ICON = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const XP = {
  bg:     'linear-gradient(155deg,#0a0a0a 0%,#111111 55%,#0a0a0a 100%)',
  bgHead: 'rgba(0,0,0,0.5)',
  border: '#2f3336',
  div:    'rgba(255,255,255,0.06)',
  text:   '#e7e9ea',
  muted:  '#71767b',
  faint:  '#3e4144',
};

export function XCard({ handle, url }) {
  ensureScStyles();
  const [copied,    setCopied]    = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('x_card_collapsed') === '1'; } catch { return false; }
  });
  const href = url || `https://x.com/${handle}`;
  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('x_card_collapsed', next ? '1' : '0'); } catch {}
  };
  const copyLink = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const fb = () => { const el = document.createElement('textarea'); el.value = href; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); done(); };
    try { navigator.clipboard.writeText(href).then(done).catch(fb); } catch { fb(); }
  };
  return (
    <div style={{ background:XP.bg, border:`1px solid ${XP.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      <div style={{ background:XP.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${XP.border}` }}>
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill={XP.text} width={18} height={18} style={{ flexShrink:0, display:'block' }}><path d={X_ICON}/></svg>
          <span style={{ fontWeight:'700', fontSize:'13px', color:XP.text, letterSpacing:'0.08em', textTransform:'uppercase' }}>x</span>
        </a>
        <div style={{ flex:1 }}/>
        <button onClick={copyLink} className="sc-hdr-btn x-hdr-btn" title="Copy link">
          {copied
            ? <svg viewBox="0 0 24 24" fill="none" stroke={XP.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
          <span className="sc-hdr-label">{copied ? 'copied!' : 'copy link'}</span>
        </button>
        <button className="sc-hdr-btn x-hdr-btn" title="Open on X" onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="sc-hdr-label">open</span>
        </button>
        <button onClick={toggleCollapse} className="sc-hdr-btn x-hdr-btn" title={collapsed ? 'Expand' : 'Collapse'} style={{ padding:'4px 5px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.25s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'50%', flexShrink:0,
            background:'#000', border:`2px solid ${XP.border}`,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill={XP.text} width={26} height={26} style={{ display:'block' }}><path d={X_ICON}/></svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:'800', fontSize:'17px', color:XP.text, lineHeight:1, marginBottom:'4px' }}>@{handle}</div>
            <div style={{ fontSize:'12px', color:XP.faint }}>x.com/{handle}</div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
              padding:'7px 14px', borderRadius:'100px', border:`1px solid ${XP.border}`,
              color:XP.text, fontSize:'12px', fontWeight:'600', textDecoration:'none',
              transition:'background 0.15s,border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor=XP.text; }}
            onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderColor=XP.border; }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width={12} height={12} style={{ flexShrink:0 }}><path d={X_ICON}/></svg>
            <span>Follow</span>
          </a>
        </div>
        <div style={{ borderTop:`1px solid ${XP.div}`, height:'10px' }}></div>
      </div>
    </div>
  );
}
