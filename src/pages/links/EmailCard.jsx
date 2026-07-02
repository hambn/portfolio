import { ensureScStyles, useCollapsed, useCopy, HeaderButtons } from './shared.jsx';
const { useState } = React;

const EMAIL_ADDRESS = 'contact@hgh.dev';

export function EmailCard({ address }) {
  ensureScStyles();
  const to = address || EMAIL_ADDRESS;
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [copied,    copyAddr]     = useCopy(to);
  const [collapsed, toggleCollapse] = useCollapsed('email_card_collapsed');
  const send = (e) => {
    e.preventDefault();
    const q = [];
    if (subject.trim()) q.push('subject=' + encodeURIComponent(subject.trim()));
    if (body.trim())    q.push('body=' + encodeURIComponent(body.trim()));
    window.location.href = `mailto:${to}${q.length ? '?' + q.join('&') : ''}`;
  };

  const EM = {
    bg:     'var(--card)',
    bgHead: 'var(--background-muted, rgba(255,255,255,0.04))',
    border: 'var(--border)',
    div:    'var(--border)',
    accent: 'var(--primary)',
    text:   'var(--foreground)',
    muted:  'var(--foreground-muted)',
    faint:  'var(--foreground-faint)',
    input:  'var(--input, var(--background-muted, rgba(255,255,255,0.03)))',
  };
  const ENV = 'M2.5 6.5A2.5 2.5 0 0 1 5 4h14a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5v-11Zm2.2-.4 7.3 5.2 7.3-5.2A.9.9 0 0 0 19 6H5a.9.9 0 0 0-.3.1ZM20 8.1l-7.4 5.3a1 1 0 0 1-1.2 0L4 8.1v9.4c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V8.1Z';

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', background: EM.input,
    border: `1px solid ${EM.border}`, borderRadius: 'var(--radius-md, 6px)',
    color: EM.text, fontSize: '13px', fontFamily: 'inherit', padding: '9px 11px',
    outline: 'none', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ background: EM.bg, border: `1px solid ${EM.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: EM.bgHead, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px',
        borderBottom: collapsed ? 'none' : `1px solid ${EM.border}` }}>
        <a href={`mailto:${to}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill={EM.accent} width={18} height={18} style={{ flexShrink: 0, display: 'block' }}><path d={ENV}/></svg>
          <span style={{ fontWeight: '700', fontSize: '13px', color: EM.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>email</span>
        </a>
        <div style={{ flex: 1 }}/>
        <HeaderButtons btnClass="sc-hdr-btn gh-hdr-btn" labelClass="sc-hdr-label" accent={EM.accent}
          copied={copied} onCopy={copyAddr} copyLabel="copy email" copyTitle="Copy email address"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>
      {/* Body — compose form */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <form onSubmit={send} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a href={`mailto:${to}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', alignSelf: 'flex-start' }}>
            <svg viewBox="0 0 24 24" fill={EM.accent} width={15} height={15} style={{ flexShrink: 0 }}><path d={ENV}/></svg>
            <span style={{ fontSize: '14px', fontWeight: '600', color: EM.text }}>{to}</span>
          </a>
          <div style={{ fontSize: '13px', color: EM.muted, lineHeight: 1.5 }}>
            got a project, question, or just want to say hi? send a message and it'll land straight in my inbox.
          </div>
          <input
            type="text" value={subject} placeholder="subject"
            onChange={e => setSubject(e.target.value)}
            onFocus={e => e.target.style.borderColor = EM.accent}
            onBlur={e => e.target.style.borderColor = EM.border}
            style={fieldStyle}
          />
          <textarea
            value={body} placeholder="your message…" rows={4}
            onChange={e => setBody(e.target.value)}
            onFocus={e => e.target.style.borderColor = EM.accent}
            onBlur={e => e.target.style.borderColor = EM.border}
            style={{ ...fieldStyle, resize: 'vertical', minHeight: '88px', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button type="submit"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '9px 18px', borderRadius: 'var(--radius-md, 6px)', border: 'none',
                background: EM.accent, color: 'var(--primary-foreground, #fff)', fontSize: '13px',
                fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              send email
            </button>
            <a href={`mailto:${to}`} style={{ fontSize: '12px', color: EM.faint, textDecoration: 'none' }}>or open your mail app →</a>
          </div>
        </form>
      </div>
    </div>
  );
}
