import '@fontsource-variable/roboto/wght.css';
import './TelegramCard.css';
import React from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const TG_ICON =
  'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z';
const TG = {
  bg: 'var(--tg-bg)',
  bgHead: 'var(--tg-bgHead)',
  border: 'var(--tg-border)',
  div: 'var(--tg-div)',
  blue: 'var(--tg-blue)',
  blueLt: 'var(--tg-blueLt)',
  text: 'var(--tg-text)',
  muted: 'var(--tg-muted)',
  faint: 'var(--tg-faint)',
};
export function TelegramCard({ handle, url }) {
  const [collapsed, toggleCollapse] = useCollapsed('tg_card_collapsed');
  const href = url || `https://t.me/${handle}`;
  const [copied, copyLink] = useCopy(href);
  return (
    <div
      style={{
        background: TG.bg,
        border: `1px solid ${TG.border}`,
      }}
      className="tg-style-1 link-card"
    >
      <div
        style={{
          background: TG.bgHead,
          borderBottom: collapsed ? 'none' : `1px solid ${TG.border}`,
        }}
        className="tg-style-2 link-card-header"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="tg-style-3 link-card-brand"
        >
          <svg viewBox="0 0 24 24" fill={TG.blue} width={24} height={24} className="tg-style-4">
            <path d={TG_ICON} />
          </svg>
          <span
            style={{
              color: TG.blueLt,
            }}
            className="tg-style-5 link-card-title"
          >
            Telegram
          </span>
        </a>
        <div className="tg-style-6 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn tg-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent={TG.blueLt}
            copied={copied}
            onCopy={copyLink}
            href={href}
            openTitle="Open Telegram"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="tg-style-7">
          <div
            style={{
              background: `linear-gradient(135deg,${TG.blue},#1a8ec3)`,
            }}
            className="tg-style-8"
          >
            <svg viewBox="0 0 24 24" fill="white" width={26} height={26} className="tg-style-9">
              <path d={TG_ICON} />
            </svg>
          </div>
          <div className="tg-style-10">
            <span className="tg-profile-label">Telegram profile</span>
            <div
              style={{
                color: TG.text,
              }}
              className="tg-style-11"
            >
              @{handle}
            </div>
            <div
              style={{
                color: TG.faint,
              }}
              className="tg-style-12"
            >
              t.me/{handle}
            </div>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              border: `1px solid ${TG.blue}`,
              color: 'white',
              background: TG.blue,
            }}
            className="tg-style-13"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              width={13}
              height={13}
              className="tg-style-14"
            >
              <path d={TG_ICON} />
            </svg>
            <span>Message</span>
          </a>
        </div>
      </div>
    </div>
  );
}
