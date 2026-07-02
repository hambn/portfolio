import { ensureScStyles, useCollapsed, useCopy, HeaderButtons } from './shared.jsx';

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
  const [collapsed, toggleCollapse] = useCollapsed('x_card_collapsed');
  const href = url || `https://x.com/${handle}`;
  const [copied, copyLink] = useCopy(href);
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
        <HeaderButtons btnClass="sc-hdr-btn x-hdr-btn" labelClass="sc-hdr-label" accent={XP.text}
          copied={copied} onCopy={copyLink}
          href={href} openTitle="Open on X"
          collapsed={collapsed} onToggle={toggleCollapse}/>
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
      </div>
    </div>
  );
}
