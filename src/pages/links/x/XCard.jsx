import './XCard.css';
import React from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
const X_ICON =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const BADGE =
  'M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2-3.58-3.58 1.41-1.41 2.17 2.17 4.56-4.56 1.41 1.41-5.97 5.97z';
export function XCard({ handle, url }) {
  const [collapsed, toggleCollapse] = useCollapsed('x_card_collapsed');
  const href = url || `https://x.com/${handle}`;
  const [copied, copyLink] = useCopy(href);
  return (
    <div
      style={{
        background: 'var(--x-bg)',
        border: '1px solid var(--x-border)',
      }}
      className="x-style-1 link-card"
    >
      <div
        style={{
          background: 'var(--x-bgHead)',
          borderBottom: collapsed ? 'none' : '1px solid var(--x-border)',
        }}
        className="x-style-2 link-card-header"
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="x-style-3 link-card-brand"
        >
          <svg
            viewBox="0 0 24 24"
            fill="var(--x-text)"
            width={24}
            height={24}
            className="x-style-4"
          >
            <path d={X_ICON} />
          </svg>
          <span
            style={{
              color: 'var(--x-text)',
            }}
            className="x-style-5 link-card-title"
          >
            X
          </span>
        </a>
        <div className="x-style-6 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn x-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent="var(--x-blue)"
            copied={copied}
            onCopy={copyLink}
            href={href}
            openTitle="Open on X"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      <div
        className={`sc-body ${collapsed ? 'closed' : 'open'}`}
        inert={collapsed ? '' : undefined}
      >
        <div className="x-style-7">
          <div style={{ borderColor: 'var(--x-border)' }} className="x-style-8">
            <svg
              viewBox="0 0 24 24"
              fill="var(--x-text)"
              width={26}
              height={26}
              className="x-style-9"
            >
              <path d={X_ICON} />
            </svg>
          </div>
          <div className="x-style-10">
            <div className="x-style-11">
              <span style={{ color: 'var(--x-text)' }}>{handle}</span>
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                className="x-badge"
                aria-label="Verified"
              >
                <path fill="var(--x-blue)" d={BADGE} />
              </svg>
            </div>
            <div style={{ color: 'var(--x-muted)' }} className="x-style-12">
              x.com/{handle}
            </div>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer" className="x-style-13">
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
        <div style={{ color: 'var(--x-text)' }} className="x-bio">
          posts, code, and the occasional hot take — straight from my timeline.
        </div>
        <div className="x-stats">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--x-text)', borderColor: 'var(--x-blue)' }}
            className="x-stat-tab x-stat-active"
          >
            Posts
          </a>
          <a
            href={`${href}/replies`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--x-muted)' }}
            className="x-stat-tab"
          >
            Replies
          </a>
          <a
            href={`${href}/media`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--x-muted)' }}
            className="x-stat-tab"
          >
            Media
          </a>
          <a
            href={`${href}/likes`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--x-muted)' }}
            className="x-stat-tab"
          >
            Likes
          </a>
        </div>
      </div>
    </div>
  );
}
