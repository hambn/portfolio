import './EmailCard.css';
import React, { useState, useId } from 'react';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
export function EmailCard({ address }) {
  const subjectId = useId();
  const to = address; // Links.jsx only mounts this card when config.email exists
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, copyAddr] = useCopy(to);
  const [collapsed, toggleCollapse] = useCollapsed('email_card_collapsed');
  const send = (e) => {
    e.preventDefault();
    const q = [];
    if (subject.trim()) q.push('subject=' + encodeURIComponent(subject.trim()));
    if (body.trim()) q.push('body=' + encodeURIComponent(body.trim()));
    window.location.href = `mailto:${to}${q.length ? '?' + q.join('&') : ''}`;
  };
  const ENV =
    'M2.5 6.5A2.5 2.5 0 0 1 5 4h14a2.5 2.5 0 0 1 2.5 2.5v11A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5v-11Zm2.2-.4 7.3 5.2 7.3-5.2A.9.9 0 0 0 19 6H5a.9.9 0 0 0-.3.1ZM20 8.1l-7.4 5.3a1 1 0 0 1-1.2 0L4 8.1v9.4c0 .55.45 1 1 1h14c.55 0 1-.45 1-1V8.1Z';
  const initials = (to.split('@')[0] || 'me')[0].toUpperCase();
  return (
    <div
      style={{
        background: 'var(--em-bg)',
        border: '1px solid var(--em-border)',
      }}
      className="em-style-1 link-card"
    >
      {/* Header — email top bar */}
      <div
        style={{
          background: 'var(--em-bgHead)',
          borderBottom: collapsed ? '1px solid var(--em-border)' : 'none',
        }}
        className="em-style-2 link-card-header"
      >
        <a href={`mailto:${to}`} className="em-style-3 link-card-brand">
          <svg
            viewBox="0 0 24 24"
            fill="var(--em-red)"
            width={24}
            height={24}
            className="em-style-4"
          >
            <path d={ENV} />
          </svg>
          <span style={{ color: 'var(--em-text)' }} className="em-style-5 link-card-title">
            Email
          </span>
        </a>
        <div className="em-style-6 link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            btnClass="sc-hdr-btn em-hdr-btn link-card-hdr-btn"
            labelClass="sc-hdr-label"
            accent="var(--em-blue)"
            copied={copied}
            onCopy={copyAddr}
            copyLabel="copy email"
            copyTitle="Copy email address"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      {/* Body — compose window */}
      <div className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <form onSubmit={send} className="em-style-7">
          <div className="em-row">
            <span className="em-row-label">To</span>
            <div className="em-chip">
              <span className="em-chip-av">{initials}</span>
              <span className="em-chip-name">{to}</span>
            </div>
          </div>
          <div className="em-row em-subject-row">
            <label htmlFor={subjectId} className="em-row-label">
              Subject
            </label>
            <input
              id={subjectId}
              type="text"
              value={subject}
              placeholder="What’s on your mind?"
              onChange={(e) => setSubject(e.target.value)}
              className="em-row-field"
            />
          </div>
          <div className="em-message">
            <textarea
              value={body}
              placeholder="Write your message…"
              aria-label="Message"
              rows={4}
              onChange={(e) => setBody(e.target.value)}
              className="em-row-field em-style-12"
            />
          </div>
          <div className="em-style-13">
            <button
              type="submit"
              style={{
                background: 'var(--em-blue)',
                color: 'var(--em-sendText)',
              }}
              className="em-style-14"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send
            </button>
            <a href={`mailto:${to}`} style={{ color: 'var(--em-muted)' }} className="em-style-15">
              or open in your mail app
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
