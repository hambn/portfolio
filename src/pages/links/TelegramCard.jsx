import { ensureScStyles, useCollapsed, useCopy, HeaderButtons } from './shared.jsx';

const TG_ICON = 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z';
const TG = {
  bg:     'linear-gradient(155deg,#0a1929 0%,#0e2038 55%,#0a1929 100%)',
  bgHead: 'rgba(0,0,0,0.45)',
  border: '#1a3a5c',
  div:    'rgba(38,165,228,0.08)',
  blue:   '#26A5E4',
  blueLt: '#60bfed',
  text:   '#e8f4fc',
  muted:  '#7eb5d4',
  faint:  '#3a6a8a',
};

export function TelegramCard({ handle, url }) {
  ensureScStyles();
  const [collapsed, toggleCollapse] = useCollapsed('tg_card_collapsed');
  const href = url || `https://t.me/${handle}`;
  const [copied, copyLink] = useCopy(href);
  return (
    <div style={{ background:TG.bg, border:`1px solid ${TG.border}`, borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
      <div style={{ background:TG.bgHead, padding:'10px 14px', display:'flex', alignItems:'center', gap:'8px',
        borderBottom: collapsed ? 'none' : `1px solid ${TG.border}` }}>
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill={TG.blue} width={18} height={18} style={{ flexShrink:0, display:'block' }}><path d={TG_ICON}/></svg>
          <span style={{ fontWeight:'700', fontSize:'13px', color:TG.blueLt, letterSpacing:'0.08em', textTransform:'uppercase' }}>telegram</span>
        </a>
        <div style={{ flex:1 }}/>
        <HeaderButtons btnClass="sc-hdr-btn tg-hdr-btn" labelClass="sc-hdr-label" accent={TG.blueLt}
          copied={copied} onCopy={copyLink}
          href={href} openTitle="Open Telegram"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'50%', flexShrink:0,
            background:`linear-gradient(135deg,${TG.blue},#1a8ec3)`,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill="white" width={26} height={26} style={{ display:'block' }}><path d={TG_ICON}/></svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:'800', fontSize:'17px', color:TG.text, lineHeight:1, marginBottom:'4px' }}>@{handle}</div>
            <div style={{ fontSize:'12px', color:TG.faint }}>t.me/{handle}</div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', flexShrink:0,
              padding:'7px 14px', borderRadius:'4px', border:`1px solid ${TG.blue}`,
              color:TG.blueLt, fontSize:'12px', fontWeight:'600', textDecoration:'none',
              transition:'background 0.15s,color 0.15s,border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(38,165,228,0.18)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color=TG.blueLt; }}>
            <svg viewBox="0 0 24 24" fill={TG.blueLt} width={13} height={13} style={{ flexShrink:0 }}><path d={TG_ICON}/></svg>
            <span>Message</span>
          </a>
        </div>
      </div>
    </div>
  );
}
