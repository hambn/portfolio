import { mediaUrl } from '../../lib/api.js';
// Home.jsx — landing page
// Data: contents/home/profile.json, contents/home/resume.json, contents/links/links.json
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import { navigate } from '../../lib/router.js';

const WorkIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="13"
    height="13"
  >
    <rect x="1.5" y="6" width="13" height="8.5" rx="1.5" />
    <path d="M5.5 6V4.5A1.5 1.5 0 0 1 7 3h2a1.5 1.5 0 0 1 1.5 1.5V6" />
    <line x1="1.5" y1="10" x2="14.5" y2="10" />
  </svg>
);

const EduIcon = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="13"
    height="13"
  >
    <polygon points="8,1.5 15.5,6 8,10.5 0.5,6" />
    <path d="M4 8.5v3a4 4 0 0 0 8 0v-3" />
    <line x1="15.5" y1="6" x2="15.5" y2="10" />
  </svg>
);

function GitTimeline({ items }) {
  return (
    <div style={{ position: 'relative', paddingLeft: '30px' }}>
      {/* vertical guide line */}
      <div
        style={{
          position: 'absolute',
          left: '13px',
          top: '6px',
          bottom: '6px',
          width: '1px',
          background: 'var(--border)',
          pointerEvents: 'none',
        }}
      />

      {items.map((item, i) => {
        const isWork = item.type === 'work';
        const isActive = item.end === 'present';
        // Two stints at the same company only read as separate roles once the
        // employment type is visible, so surface it when the data has one.
        const badge = item.employment;

        return (
          <div
            key={i}
            style={{ position: 'relative', paddingBottom: i < items.length - 1 ? '26px' : 0 }}
          >
            {/* icon node — sits on top of the guide line */}
            <div
              style={{
                position: 'absolute',
                left: '-24px',
                top: '1px',
                color: isActive ? 'var(--primary)' : 'var(--foreground-subtle)',
                background: 'var(--background)',
                width: '15px',
                height: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1px',
              }}
            >
              {isWork ? <WorkIcon /> : <EduIcon />}
            </div>

            {/* role + date — stacks on mobile */}
            <div
              className="timeline-heading"
              style={{
                display: 'flex',

                justifyContent: 'space-between',

                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontWeight: '600',
                  fontSize: 'var(--text-base)',
                  color: 'var(--foreground)',
                  letterSpacing: '-0.01em',
                }}
              >
                {item.role || item.degree}
                {badge && <span className="timeline-badge">{badge}</span>}
              </span>

              {/* date — "present" highlighted blue */}
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  flexShrink: 0,
                  color: 'var(--foreground-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.start}
                <span style={{ margin: '0 2px' }}>–</span>
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--foreground-muted)' }}>
                  {item.end}
                </span>
              </span>
            </div>

            {/* company / school + location */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--text-sm)',
                marginBottom: item.description ? '6px' : 0,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: isActive ? 'var(--primary)' : 'var(--foreground-muted)' }}>
                {item.company || item.school}
              </span>
              {item.location && (
                <span style={{ color: 'var(--foreground-subtle)' }}>· {item.location}</span>
              )}
            </div>

            {/* description bullets */}
            {item.description && (
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--foreground-muted)',
                  lineHeight: '1.75',
                }}
              >
                {Array.isArray(item.description)
                  ? item.description.map((d, j) => (
                      <div key={j} style={{ paddingLeft: '12px', position: 'relative' }}>
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            color: 'var(--foreground-subtle)',
                          }}
                        >
                          ·
                        </span>
                        {d}
                      </div>
                    ))
                  : item.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));
  const [resume, setResume] = useState(() => PortfolioData.peek('resume'));
  const [links, setLinks] = useState(() => PortfolioData.peek('links'));

  useEffect(() => {
    PortfolioData.getProfile()
      .then(setProfile)
      .catch(() => {});
    PortfolioData.getResume()
      .then(setResume)
      .catch(() => {});
    PortfolioData.getLinks()
      .then(setLinks)
      .catch(() => {});
  }, []);

  const hasResume = resume && resume.items?.length;

  // Footer quick-links — driven by links.json so no duplication
  const footerLinks = links
    ? ['github', 'x', 'telegram']
        .filter((k) => links[k])
        .map((k) => ({ label: k, url: links[k].url }))
    : [];

  return (
    <main
      className="home-page"
      style={{
        maxWidth: '760px',
        margin: '0 auto',
      }}
    >
      {/* ── Intro ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <img
          src={
            profile?.avatar ||
            (profile?.handle &&
              mediaUrl(`https://avatars.githubusercontent.com/${profile.handle}`)) ||
            undefined
          }
          alt={profile?.name || ''}
          width="72"
          height="72"
          decoding="async"
          fetchpriority="high"
          className="home-avatar"
        />
        <div>
          <h1
            style={{
              fontSize: 'var(--text-3xl)',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}
          >
            {profile?.name || ''}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: '500', color: 'var(--primary)' }}>
            @{profile?.handle || ''}
          </p>
        </div>
      </div>

      {/* intro paragraphs — falls back to the one-line bio used for meta/cards */}
      <div
        style={{
          color: 'var(--foreground-muted)',
          fontSize: 'var(--text-base)',
          lineHeight: '1.85',
          // ~70 characters per line — comfortable for multi-sentence paragraphs.
          maxWidth: '620px',
          marginBottom: '36px',
          display: 'grid',
          gap: '18px',
        }}
      >
        {(profile?.intro?.length ? profile.intro : [profile?.bio].filter(Boolean)).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '56px' }}>
        <a
          href={import.meta.env.BASE_URL + 'projects/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('projects');
          }}
          className="btn btn-default btn-md"
        >
          projects
        </a>
        <a
          href={import.meta.env.BASE_URL + 'blog/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('blog');
          }}
          className="btn btn-outline btn-md"
        >
          blog
        </a>
        <a
          href={import.meta.env.BASE_URL + 'links/'}
          onClick={(e) => {
            e.preventDefault();
            navigate('links');
          }}
          className="btn btn-ghost btn-md"
        >
          social & contact →
        </a>
      </div>

      {/* ── Work & education timeline ── */}
      {hasResume && (
        <div style={{ marginBottom: '56px' }}>
          {/* label — rule — resume link, so the section closes itself */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <h2 className="section-label">work &amp; education</h2>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <a
              href={import.meta.env.BASE_URL + 'resume/'}
              onClick={(e) => {
                e.preventDefault();
                navigate('resume');
              }}
              className="link-quiet"
              style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
            >
              full resume →
            </a>
          </div>
          <GitTimeline items={resume.items || []} />
        </div>
      )}

      {/* ── Footer quick-links ── */}
      {footerLinks.length > 0 && (
        <div style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {footerLinks.map(({ label, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-quiet"
                style={{ fontSize: 'var(--text-xs)' }}
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
