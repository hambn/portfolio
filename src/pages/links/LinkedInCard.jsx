import { ensureScStyles, useCollapsed, useCopy, HeaderButtons } from './shared.jsx';
const { useState } = React;

// Simple Icons LinkedIn glyph
const LI_ICON = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.2 23.227 23.2 22.271V1.729C24 .774 23.2 0 22.222 0h.003z';

let _liStyleDone = false;
function ensureLiStyles() {
  if (_liStyleDone) return;
  _liStyleDone = true;
  const el = document.createElement('style');
  el.textContent = `
    .li-view-btn{transition:background 0.15s,border-color 0.15s,color 0.15s;}
    .li-view-btn:hover{background:rgba(112,181,249,0.18) !important;border-color:#70b5f9 !important;color:#fff !important;}
  `;
  document.head.appendChild(el);
}

export function LinkedInCard({ handle, url, name, headline, location, connections, followers, banner, avatar }) {
  ensureScStyles();
  ensureLiStyles();

  const profileHref = url || `https://linkedin.com/in/${handle}`;
  const [imgError,    setImgError]    = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [copied,      copyLink]       = useCopy(profileHref);
  const [collapsed,   toggleCollapse] = useCollapsed('li_card_collapsed');

  // NOTE: LinkedIn profile HTML cannot be fetched from the browser due to CORS.
  // All profile fields come from contents/links/links.json — no proxy, no server.

  const showAvatar = avatar && !imgError;

  const LI = {
    card:   '#1d2226',
    banner: 'linear-gradient(125deg, #004182 0%, #0A66C2 55%, #005fa3 100%)',
    border: '#38434f',
    div:    'rgba(255,255,255,0.08)',
    blue:   '#0A66C2',
    blueLt: '#70b5f9',
    text:   '#e7e9ea',
    muted:  '#b0b7be',
    faint:  '#6d7a86',
    bgHead: 'rgba(0,0,0,0.55)',
  };

  return (
    <div style={{ background: LI.card, border: `1px solid ${LI.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>

      {/* ── Header bar — always visible (mirrors Spotify header) ── */}
      <div style={{ background: LI.bgHead, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: collapsed ? 'none' : `1px solid ${LI.border}` }}>

        {/* Icon + wordmark — clickable */}
        <a href={profileHref} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ background: LI.blue, borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="white" width="13" height="13"><path d={LI_ICON}/></svg>
          </div>
          <span style={{ fontWeight: '700', fontSize: '13px', color: LI.blueLt, letterSpacing: '0.08em', textTransform: 'uppercase' }}>linkedin</span>
        </a>

        <div style={{ flex: 1 }} />

        <HeaderButtons btnClass="sc-hdr-btn li-hdr-btn" labelClass="sc-hdr-label" accent={LI.blueLt}
          copied={copied} onCopy={copyLink} copyTitle="Copy profile link"
          href={profileHref} openLabel="open profile" openTitle="Open on LinkedIn"
          collapsed={collapsed} onToggle={toggleCollapse}/>
      </div>

      {/* ── Collapsible body ── */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>

        {/* Banner */}
        <div style={{ height: '100px', background: LI.banner, position: 'relative', flexShrink: 0 }}>
          {banner && !bannerError && (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
              <img src={banner} alt="" onError={() => setBannerError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          {/* Avatar overlapping banner */}
          <div style={{ position: 'absolute', bottom: '-38px', left: '22px' }}>
            {showAvatar ? (
              <img src={avatar} alt={name || handle} onError={() => setImgError(true)}
                style={{ width: '76px', height: '76px', borderRadius: '50%', border: '3px solid #1d2226', display: 'block', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', border: '3px solid #1d2226', background: LI.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="white" width="38" height="38"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              </div>
            )}
          </div>
        </div>

        {/* Identity */}
        <div style={{ padding: '46px 22px 18px', borderBottom: `1px solid ${LI.div}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              {name && (
                <div style={{ fontWeight: '700', fontSize: '20px', color: LI.text, lineHeight: 1.2, marginBottom: '4px' }}>{name}</div>
              )}
              {headline && (
                <div style={{ fontSize: '13px', color: LI.muted, lineHeight: 1.5, marginBottom: '8px' }}>{headline}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {location && (
                  <span style={{ fontSize: '12px', color: LI.faint, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    {location}
                  </span>
                )}
                {connections && (
                  <span style={{ fontSize: '12px', color: LI.blueLt, fontWeight: '600' }}>{connections} connections</span>
                )}
                {followers != null && (
                  <span style={{ fontSize: '12px', color: LI.faint }}>{Number(followers).toLocaleString()} followers</span>
                )}
              </div>
            </div>

            {/* View profile pill */}
            <a href={profileHref} target="_blank" rel="noopener noreferrer" className="li-view-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px',
                border: `1px solid ${LI.blue}`, borderRadius: '100px', flexShrink: 0,
                color: LI.blueLt, fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d={LI_ICON}/></svg>
              View profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
