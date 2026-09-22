// Resume.jsx — printable CV, integrated into the SPA router
import './resume.css';
import React, { useEffect, useState } from 'react';
import { PortfolioData } from '../../lib/data.js';
import ErrorState from '../../components/ErrorState.jsx';

function ResumeSectionLabel({ text }) {
  return (
    <div className="resume-section-label">
      <h2>{text}</h2>
      <div className="resume-rule" />
    </div>
  );
}

function ResumeEntry({
  role,
  degree,
  company,
  school,
  location,
  start,
  end,
  description,
  employment,
}) {
  const active = end === 'present' ? ' is-active' : '';

  return (
    <div className="resume-entry">
      <div className="resume-entry-head">
        <span className="resume-entry-title">{role || degree}</span>
        <span className="resume-entry-dates">
          {start}
          <span className="resume-dash">–</span>
          <span className={active.trim() || undefined}>{end}</span>
        </span>
      </div>

      <div className="resume-entry-meta">
        <span className={`resume-entry-org${active}`}>{company || school}</span>
        {location && <span className="resume-entry-location">· {location}</span>}
        {employment && <span className="resume-entry-employment">{employment}</span>}
      </div>

      {description &&
        (Array.isArray(description) ? (
          <div>
            {description.map((d, i) => (
              <div key={i} className="resume-entry-text resume-entry-line">
                {d}
              </div>
            ))}
          </div>
        ) : (
          <p className="resume-entry-text">{description}</p>
        ))}
    </div>
  );
}

function ResumeSection({ label, items }) {
  if (!items.length) return null;
  return (
    <section className="resume-section">
      <ResumeSectionLabel text={label} />
      {items.map((item, i) => (
        <ResumeEntry key={i} {...item} />
      ))}
      <div className="resume-rule" />
    </section>
  );
}

export default function Resume() {
  const [resume, setResume] = useState(() => PortfolioData.peek('resume'));
  const [profile, setProfile] = useState(() => PortfolioData.peek('profile'));
  const [links, setLinks] = useState(() => PortfolioData.peek('links'));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    Promise.all([
      PortfolioData.getResume().then((d) => {
        if (alive) setResume(d);
      }),
      PortfolioData.getProfile().then((d) => {
        if (alive) setProfile(d);
      }),
      PortfolioData.getLinks().then((d) => {
        if (alive) setLinks(d);
      }),
    ]).catch(() => {
      if (alive) setError(true);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const experience = resume?.items?.filter((i) => i.type === 'work') || [];
  const education = resume?.items?.filter((i) => i.type === 'education') || [];
  const skills = resume?.skills || [];

  const contactItems = [
    links?.email && {
      label: 'email',
      href: 'mailto:' + links.email.address,
      text: links.email.address,
    },
    links?.github && {
      label: 'github',
      href: links.github.url,
      text: 'github.com/' + (links.github.username || ''),
    },
    links?.telegram && {
      label: 'telegram',
      href: links.telegram.url,
      text: 't.me/' + (links.telegram.handle || ''),
    },
    links?.linkedin && {
      label: 'linkedin',
      href: links.linkedin.url,
      text: 'linkedin.com/in/' + (links.linkedin.handle || ''),
    },
  ].filter(Boolean);

  return (
    <main className="resume-main">
      <button type="button" className="resume-print-btn" onClick={() => window.print()}>
        print / save pdf
      </button>

      {error && (
        <div className="resume-error">
          <ErrorState
            message="failed to load resume data."
            onRetry={() => setAttempt((a) => a + 1)}
          />
        </div>
      )}
      <header className="resume-header">
        <div>
          <h1 className="resume-name">{profile?.name || ''}</h1>
          <p className="resume-role">{profile?.title || ''}</p>
        </div>

        {contactItems.length > 0 && (
          <div className="resume-contact">
            {contactItems.map(({ label, href, text }) => (
              <div key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {text}
                </a>
              </div>
            ))}
          </div>
        )}
      </header>

      {profile?.bio && <p className="resume-bio">{profile.bio}</p>}

      <div className="resume-rule resume-divider" />

      <ResumeSection label="experience" items={experience} />
      <ResumeSection label="education" items={education} />

      {skills.length > 0 && (
        <section className="resume-section">
          <ResumeSectionLabel text="skills" />
          <div className="resume-skills">
            {skills.map((s) => (
              <span key={s} className="resume-skill">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
