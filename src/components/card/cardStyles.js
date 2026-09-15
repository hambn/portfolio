// One-time injection of the .sc-* classes shared by every link card.

let _scStyleDone = false;

export function ensureScStyles() {
  if (_scStyleDone) return;
  _scStyleDone = true;
  const el = document.createElement('style');
  el.textContent = `
    .sc-hdr-btn{opacity:0.55;transition:opacity 0.12s,color 0.12s;background:none;border:none;cursor:pointer;
      display:flex;align-items:center;gap:5px;padding:4px 7px;border-radius:4px;
      font-size:11px;font-family:inherit;white-space:nowrap;}
    .sc-hdr-btn:hover{opacity:1;}
    .tg-hdr-btn{color:#7eb5d4;}
    .tg-hdr-btn:hover{color:#e8f4fc;}
    .x-hdr-btn{color:#71767b;}
    .x-hdr-btn:hover{color:#e7e9ea;}
    .gh-hdr-btn{color:#8b949e;}
    .gh-hdr-btn:hover{color:#e6edf3;}
    .gl-hdr-btn{color:#a1a1aa;}
    .gl-hdr-btn:hover{color:#ececef;}
    .sp-hdr-btn{color:#b3b3b3;}
    .sp-hdr-btn:hover{color:#fff;}
    .st-hdr-btn{color:#8f98a0;}
    .st-hdr-btn:hover{color:#c7d5e0;}
    .dc-hdr-btn{color:#80848e;}
    .dc-hdr-btn:hover{color:#dbdee1;}
    .li-hdr-btn{color:#b0b7be;}
    .li-hdr-btn:hover{color:#e7e9ea;}
    .sc-body{overflow:hidden;transition:max-height 0.35s ease,opacity 0.22s ease,visibility 0.35s;}
    .sc-body.open{max-height:4000px;opacity:1;visibility:visible;}
    .sc-body.closed{max-height:0;opacity:0;visibility:hidden;pointer-events:none;}
    @media(max-width:540px){
      .sc-hdr-label{display:none;}
      .sc-hdr-btn{padding:4px 5px;}
    }
  `;
  document.head.appendChild(el);
}
