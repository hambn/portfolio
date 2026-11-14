import './EmailCard.css';
import React, { useCallback, useId, useRef, useState } from 'react';
import { apiUrl } from '../../../lib/api.js';
import { useCollapsed } from '../../../hooks/useCollapsed.js';
import { useCopy } from '../../../hooks/useCopy.js';
import { HeaderButtons } from '../../../components/card/HeaderButtons.jsx';
import { BRAND_ICON } from '../brandIcons.js';

// Mirrors the API's own structural check closely enough to catch a typo before
// a request is spent; the API stays the authority.
const LOOKS_LIKE_EMAIL = /^[^\s@,;<>]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const MESSAGES = {
  invalid_from: 'That address doesn’t look right — check it and try again.',
  undeliverable_from: 'That domain can’t receive mail, so I’d have no way to reply.',
  message_too_short: 'Add a little more to your message.',
  invalid_token: 'This form expired. Reload the page and send again.',
  duplicate_message: 'That message just went through — no need to send it twice.',
  ip_rate_limited: 'You’ve sent a few already. Try again later, or use your mail app.',
  mail_paused: 'The form is at its daily limit. Please use your mail app instead.',
  contact_not_configured: 'The form is offline right now — use your mail app instead.',
};
const FALLBACK = 'Couldn’t send that. Please use your mail app instead.';
// A little over the API's 3-second minimum, and a little under its 30-minute
// maximum, to absorb transit time.
const TOKEN_MIN_AGE_MS = 3500;
const TOKEN_MAX_AGE_MS = 29 * 60 * 1000;
const ENV = BRAND_ICON.email;

export const EmailCard = React.memo(function EmailCard({ address }) {
  const fromId = useId();
  const subjectId = useId();
  const to = address; // Links.jsx only mounts this card when config.email exists
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState(null); // { kind: 'error' | 'sent', text }
  const [sending, setSending] = useState(false);
  const [copied, copyAddr] = useCopy(to);
  const [collapsed, toggleCollapse] = useCollapsed('email_card_collapsed');
  const token = useRef(null);

  const minting = useRef(null);

  // One token per open form. It is minted server-side and single-use, which is
  // what keeps a script from POSTing this endpoint directly.
  const mint = useCallback(() => {
    minting.current ??= (async () => {
      try {
        const response = await fetch(apiUrl('/contact'), {
          headers: { Accept: 'application/json' },
        });
        const data = await response.json();
        token.current = data.token ? { value: data.token, at: Date.now() } : null;
      } catch {
        token.current = null;
      } finally {
        minting.current = null;
      }
    })();
    return minting.current;
  }, []);

  // The API accepts a token between 3 seconds and 30 minutes after minting.
  // An old one is replaced and a new one waited out, so a slow writer or a
  // quick resend never sees a spurious "expired" error.
  const freshToken = async () => {
    if (!token.current || Date.now() - token.current.at > TOKEN_MAX_AGE_MS) await mint();
    if (!token.current) return '';
    const wait = TOKEN_MIN_AGE_MS - (Date.now() - token.current.at);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return token.current.value;
  };
  // Most visitors never write here, so the token is asked for when one starts
  // to (the first focus or touch inside the form), not when the page opens.
  const prepare = () => {
    if (!token.current) void mint();
  };

  const mailto = `mailto:${to}${subject.trim() ? `?subject=${encodeURIComponent(subject.trim())}` : ''}`;

  const send = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!LOOKS_LIKE_EMAIL.test(from.trim())) {
      setStatus({ kind: 'error', text: MESSAGES.invalid_from });
      return;
    }
    if (body.trim().length < 10) {
      setStatus({ kind: 'error', text: MESSAGES.message_too_short });
      return;
    }
    setSending(true);
    setStatus(null);
    const submit = async () => {
      const form = await freshToken();
      const response = await fetch(apiUrl('/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: from.trim(),
          subject: subject.trim(),
          message: body,
          token: form,
          website: honeypot,
        }),
      });
      // A token is never reused, whether or not the message went through.
      token.current = null;
      return [response, await response.json().catch(() => ({}))];
    };
    try {
      let [response, data] = await submit();
      // A token refused anyway (clock skew, or open in two tabs) gets one
      // silent retry with a new one.
      if (data.error === 'invalid_token') [response, data] = await submit();
      if (response.ok && data.ok) {
        setStatus({ kind: 'sent', text: 'Sent — I’ll reply to ' + from.trim() + '.' });
        setSubject('');
        setBody('');
      } else {
        setStatus({ kind: 'error', text: MESSAGES[data.error] || FALLBACK });
        void mint();
      }
    } catch {
      setStatus({ kind: 'error', text: FALLBACK });
      void mint();
    } finally {
      setSending(false);
    }
  };

  const initials = (to.split('@')[0] || 'me')[0].toUpperCase();
  return (
    <div className="em-card link-card">
      {/* Header — email top bar */}
      <div className="em-header link-card-header">
        <a href={`mailto:${to}`} className="link-card-brand">
          <svg viewBox="0 0 24 24" width={24} height={24} className="em-logo">
            <path d={ENV} />
          </svg>
          <span className="em-wordmark link-card-title">Email</span>
        </a>
        <div className="link-card-spacer" />
        <div className="link-card-actions">
          <HeaderButtons
            accent="var(--em-blue)"
            copied={copied}
            onCopy={copyAddr}
            copyTitle="Copy email address"
            href={`mailto:${to}`}
            openTitle="Open in your mail app"
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      </div>
      {/* Body — compose window */}
      <div data-card="email" className={`sc-body ${collapsed ? 'closed' : 'open'}`}>
        <div className="em-compose-bar">New message</div>
        <form
          onSubmit={send}
          onFocus={prepare}
          onPointerDown={prepare}
          className="em-form"
          noValidate
        >
          <div className="em-row em-field-row">
            <label htmlFor={fromId} className="em-row-label">
              From
            </label>
            <input
              id={fromId}
              type="email"
              value={from}
              autoComplete="email"
              inputMode="email"
              placeholder="your@email.com"
              onChange={(e) => setFrom(e.target.value)}
              className="em-row-field"
              required
            />
          </div>
          <div className="em-row">
            <span className="em-row-label">To</span>
            <div className="em-chip">
              <span className="em-chip-av">{initials}</span>
              <span className="em-chip-name">{to}</span>
            </div>
          </div>
          <div className="em-row em-field-row">
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
          {/* Honeypot: off-screen and skipped by keyboard and assistive tech. */}
          <div className="em-trap" aria-hidden="true">
            <label htmlFor={`${fromId}-website`}>Website</label>
            <input
              id={`${fromId}-website`}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
          <div className="em-message">
            <textarea
              value={body}
              placeholder="Write your message…"
              aria-label="Message"
              rows={4}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
              className="em-row-field em-body-field"
            />
          </div>
          <div className="em-actions">
            <button type="submit" disabled={sending} className="em-send">
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
              {sending ? 'Sending…' : 'Send'}
            </button>
            <a href={mailto} className="em-mailto">
              or open in your mail app
            </a>
            {status && (
              <span
                role="status"
                className={`em-status ${status.kind === 'error' ? 'is-error' : 'is-sent'}`}
              >
                {status.text}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
});
