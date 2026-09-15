import './XCard.css';
import React from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const X_ICON =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const XP = {
  bg: 'linear-gradient(155deg,#0a0a0a 0%,#111111 55%,#0a0a0a 100%)',
  bgHead: 'rgba(0,0,0,0.5)',
  border: '#2f3336',
  div: 'rgba(255,255,255,0.06)',
  text: '#e7e9ea',
  muted: '#71767b',
  faint: '#3e4144',
};
export function XCard({ handle, url }) {
  const [collapsed, toggleCollapse] = useCollapsed('x_card_collapsed');
  const href = url || `https://x.com/${handle}`;
  const [copied, copyLink] = useCopy(href);
  return (
    <div
      style={{
        background: XP.bg,
        border: `1px solid ${XP.border}`,
      }}
      className="x-style-1"
    >
      <div
        style={{
          background: XP.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${XP.border}`,
        }}
        className="x-style-2"
      >
        <a href={href} target="_blank" rel="noopener noreferrer" className="x-style-3">
          <svg viewBox="0 0 24 24" fill={XP.text} width={18} height={18} className="x-style-4">
            <path d={X_ICON} />
          </svg>
          <span
            style={{
              color: XP.text,
            }}
            className="x-style-5"
          >
            x
          </span>
        </a>
        <div className="x-style-6" />
        <HeaderButtons
          btnClass="sc-hdr-btn x-hdr-btn"
          labelClass="sc-hdr-label"
          accent={XP.text}
          copied={copied}
          onCopy={copyLink}
          href={href}
          openTitle="Open on X"
          collapsed={collapsed}
          onToggle={toggleCollapse}
        />
      </div>
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div className="x-style-7">
          <div
            style={{
              border: `2px solid ${XP.border}`,
            }}
            className="x-style-8"
          >
            <svg viewBox="0 0 24 24" fill={XP.text} width={26} height={26} className="x-style-9">
              <path d={X_ICON} />
            </svg>
          </div>
          <div className="x-style-10">
            <div
              style={{
                color: XP.text,
              }}
              className="x-style-11"
            >
              @{handle}
            </div>
            <div
              style={{
                color: XP.faint,
              }}
              className="x-style-12"
            >
              x.com/{handle}
            </div>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: `1px solid ${XP.border}`,
              color: XP.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = XP.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
              e.currentTarget.style.borderColor = XP.border;
            }}
            className="x-style-13"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width={12}
              height={12}
              className="x-style-14"
            >
              <path d={X_ICON} />
            </svg>
            <span>Follow</span>
          </a>
        </div>
      </div>
    </div>
  );
}
